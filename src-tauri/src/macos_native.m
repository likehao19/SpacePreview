#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <Carbon/Carbon.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

typedef bool (*SpaceCallback)(uint32_t, uint64_t, int32_t, bool);
static SpaceCallback spaceCallback;
static atomic_bool tapRunning = false;
static atomic_bool automationAllowed = false;
static CFMachPortRef keyboardTap;
static atomic_uint_fast64_t shortcutConfig = 49;
static atomic_uint lastKeyResult = 0;
uint32_t sp_mac_last_key_result(void) { return atomic_load(&lastKeyResult); }

// Keep AppKit's rounded frame and shadow while using our compact toolbar.
void sp_mac_configure_window(void *handle) {
    NSWindow *window = (__bridge NSWindow *)handle;
    for (NSNumber *button in @[@(NSWindowCloseButton), @(NSWindowMiniaturizeButton), @(NSWindowZoomButton)]) {
        [window standardWindowButton:button.unsignedIntegerValue].hidden = YES;
    }
}


void sp_mac_set_shortcut(uint32_t key, uint64_t flags) {
    atomic_store(&shortcutConfig, key | (flags << 16));
}

int32_t sp_mac_frontmost_pid(void) {
    @autoreleasepool {
        return NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    }
}

static bool finderIsFrontmost(void) {
    return [NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier
        isEqualToString:@"com.apple.finder"];
}

static id attribute(AXUIElementRef element, CFStringRef name) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, name, &value) != kAXErrorSuccess) {
        return nil;
    }
    return CFBridgingRelease(value);
}

// Retain the original file view, not just Finder's process (tabs share a PID).
static id navigationView;
static id focusedFileView(int32_t pid) {
    AXUIElementRef app = AXUIElementCreateApplication(pid);
    AXUIElementSetMessagingTimeout(app, 0.05f);
    id current = attribute(app, kAXFocusedUIElementAttribute);
    CFRelease(app);
    for (int depth = 0; current && depth < 16; depth++) {
        AXUIElementRef element = (__bridge AXUIElementRef)current;
        AXUIElementSetMessagingTimeout(element, 0.05f);
        NSString *role = attribute(element, kAXRoleAttribute);
        if ([@[@"AXTextField", @"AXTextArea", @"AXComboBox"] containsObject:role ?: @""]) return nil;
        if ([@[@"AXList", @"AXTable", @"AXOutline", @"AXCollection", @"AXBrowser", @"AXLayoutArea"] containsObject:role ?: @""])
            return current;
        current = attribute(element, kAXParentAttribute);
    }
    return nil;
}
void sp_mac_capture_navigation(int32_t pid) { navigationView = focusedFileView(pid); }
bool sp_mac_navigation_valid(int32_t pid) {
    id current = focusedFileView(pid);
    return navigationView && current && CFEqual((__bridge CFTypeRef)navigationView, (__bridge CFTypeRef)current);
}
bool sp_mac_navigate(int32_t pid, int32_t direction) {
    if (!sp_mac_navigation_valid(pid)) return false;
    CGKeyCode key = direction < 0 ? 126 : 125;
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, key, true);
    CGEventRef up = CGEventCreateKeyboardEvent(NULL, key, false);
    if (!down || !up) {
        if (down) CFRelease(down);
        if (up) CFRelease(up);
        return false;
    }
    CGEventSetFlags(down, 0);
    CGEventSetFlags(up, 0);
    CGEventPostToPid(pid, down);
    CGEventPostToPid(pid, up);
    CFRelease(down);
    CFRelease(up);
    return true;
}

static bool fileAreaHasFocus(void) {
    if (!finderIsFrontmost()) { atomic_store(&lastKeyResult, 1); return false; }
    AXUIElementRef system = AXUIElementCreateApplication(sp_mac_frontmost_pid());
    // Query Finder directly; 5 ms was too short for a busy accessibility server.
    AXUIElementSetMessagingTimeout(system, 0.02f);
    id focused = attribute(system, kAXFocusedUIElementAttribute);
    CFRelease(system);
    if (!focused) { atomic_store(&lastKeyResult, 3); return false; }
    bool fileArea = false;
    id current = focused;
    const CFAbsoluteTime deadline = CFAbsoluteTimeGetCurrent() + 0.12;
    for (int depth = 0; current && depth < 16; depth++) {
        if (CFAbsoluteTimeGetCurrent() >= deadline) break;
        AXUIElementRef element = (__bridge AXUIElementRef)current;
        AXUIElementSetMessagingTimeout(element, 0.02f);
        NSString *role = attribute(element, kAXRoleAttribute);
        NSString *subrole = attribute(element, kAXSubroleAttribute);
        NSString *identifier = attribute(element, CFSTR("AXIdentifier"));
        if ([role isEqualToString:@"AXTextField"] ||
            [role isEqualToString:@"AXTextArea"] ||
            [role isEqualToString:@"AXComboBox"] ||
            [role isEqualToString:@"AXToolbar"] ||
            [role isEqualToString:@"AXMenu"] ||
            [subrole isEqualToString:@"AXSourceList"] ||
            [subrole isEqualToString:@"AXSearchField"] ||
            (identifier && [identifier rangeOfString:@"sidebar" options:NSCaseInsensitiveSearch].location != NSNotFound)) {
            atomic_store(&lastKeyResult, 4);
            return false;
        }
        if ([@[@"AXList", @"AXTable", @"AXOutline", @"AXCollection", @"AXBrowser", @"AXLayoutArea", @"AXScrollArea"]
            containsObject:role ?: @""]) {
            fileArea = true;
        }
        if ([role isEqualToString:@"AXWindow"] || [role isEqualToString:@"AXApplication"]) {
            atomic_store(&lastKeyResult, fileArea ? 6 : 5);
            return fileArea;
        }
        current = attribute(element, kAXParentAttribute);
    }
    atomic_store(&lastKeyResult, 3);
    return false;
}

static CGEventRef handleKey(CGEventTapProxy proxy, CGEventType type,
                           CGEventRef event, void *context) {
    (void)proxy;
    (void)context;
    @autoreleasepool {
        if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
            spaceCallback(0, 0, 0, false);
            atomic_store(&tapRunning, false);
            return event;
        }
        uint64_t config = atomic_load(&shortcutConfig);
        static uint64_t previousConfig = 49;
        if (config != previousConfig) {
            spaceCallback(0, 0, 0, false);
            previousConfig = config;
        }
        if (CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) != (config & 255)) return event;
        bool repeat = CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat) != 0;
        int32_t pid = 0;
        CGEventFlags flags = CGEventGetFlags(event);
        if (type == kCGEventKeyDown && !repeat &&
            (flags & (kCGEventFlagMaskControl | kCGEventFlagMaskAlternate | kCGEventFlagMaskCommand)) == (config >> 16)) {
            if (!atomic_load(&automationAllowed)) atomic_store(&lastKeyResult, 2);
            else if (fileAreaHasFocus()) pid = sp_mac_frontmost_pid();
        }
        return spaceCallback(type, flags, pid, repeat) ? NULL : event;
    }
}

void sp_mac_start(SpaceCallback callback) {
    spaceCallback = callback;
    [NSThread detachNewThreadWithBlock:^{
        for (;;) {
            @autoreleasepool {
                // Start quietly; the settings button is the permission entry point.
                if (!AXIsProcessTrusted()) {
                    atomic_store(&tapRunning, false);
                    [NSThread sleepForTimeInterval:1.0];
                    continue;
                }
                keyboardTap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap,
                    kCGEventTapOptionDefault,
                    CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp),
                    handleKey, NULL);
                if (!keyboardTap) {
                    [NSThread sleepForTimeInterval:1.0];
                    continue;
                }
                CFRunLoopSourceRef source = CFMachPortCreateRunLoopSource(NULL, keyboardTap, 0);
                if (!source) {
                    CFRelease(keyboardTap);
                    [NSThread sleepForTimeInterval:1.0];
                    continue;
                }
                CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
                while (AXIsProcessTrusted()) {
                    if (!CGEventTapIsEnabled(keyboardTap)) {
                        spaceCallback(0, 0, 0, false);
                        CGEventTapEnable(keyboardTap, true);
                    }
                    atomic_store(&tapRunning, CGEventTapIsEnabled(keyboardTap));
                    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 1.0, false);
                }
                atomic_store(&tapRunning, false);
                spaceCallback(0, 0, 0, false);
                CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
                CFMachPortInvalidate(keyboardTap);
                CFRelease(source);
                CFRelease(keyboardTap);
                keyboardTap = NULL;
            }
        }
    }];
}

static OSStatus finderPermission(bool prompt) {
    NSAppleEventDescriptor *target =
        [NSAppleEventDescriptor descriptorWithBundleIdentifier:@"com.apple.finder"];
    return AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, prompt);
}

uint32_t sp_mac_status(void) {
    @autoreleasepool {
        bool automation = finderPermission(false) == noErr;
        atomic_store(&automationAllowed, automation);
        return (AXIsProcessTrusted() ? 1 : 0) |
            (atomic_load(&tapRunning) ? 2 : 0) |
            (automation ? 4 : 0);
    }
}

void sp_mac_request_permissions(void) {
    @autoreleasepool {
        AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)@{
            (__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES
        });
        bool automation = finderPermission(true) == noErr;
        atomic_store(&automationAllowed, automation);
        // A previously denied permission does not show the system prompt again.
        NSString *pane = !AXIsProcessTrusted() ? @"Privacy_Accessibility"
            : !automation ? @"Privacy_Automation"
            : !atomic_load(&tapRunning) ? @"Privacy_ListenEvent" : nil;
        if (pane) {
            NSURL *url = [NSURL URLWithString:[@"x-apple.systempreferences:com.apple.preference.security?" stringByAppendingString:pane]];
            [NSWorkspace.sharedWorkspace openURL:url];
        }
    }
}

char *sp_mac_copy_selection(void) {
    @autoreleasepool {
        NSAppleScript *script = [[NSAppleScript alloc] initWithSource:
            @"with timeout of 3 seconds\n"
             "tell application id \"com.apple.finder\"\n"
             "set selectedItems to selection\n"
             "set chosenPaths to {}\n"
             "repeat with i from 1 to (count selectedItems)\n"
             "if i > 100 then exit repeat\n"
             "try\n"
             "set end of chosenPaths to POSIX path of ((item i of selectedItems) as alias)\n"
             "end try\n"
             "end repeat\n"
             "return chosenPaths\n"
             "end tell\n"
             "end timeout"];
        NSDictionary *error = nil;
        NSAppleEventDescriptor *result = [script executeAndReturnError:&error];
        NSDictionary *payload;
        if (!result) {
            NSString *message = [error[NSAppleScriptErrorNumber] intValue] == -1743
                ? @"请在系统设置 → 隐私与安全性 → 自动化中允许瞬览控制 Finder。"
                : @"Finder 暂时无法读取所选文件，请确认权限后重试。";
            payload = @{@"error": message};
        } else {
            NSMutableArray<NSString *> *paths = [NSMutableArray array];
            for (NSInteger i = 1; i <= result.numberOfItems && i <= 100; i++) {
                NSString *path = [result descriptorAtIndex:i].stringValue;
                if (path.length) [paths addObject:path];
            }
            payload = @{@"paths": paths};
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
        NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        return json ? strdup(json.UTF8String) : NULL;
    }
}

void sp_mac_free_string(char *value) { free(value); }

void sp_mac_activate_finder(int32_t pid) {
    @autoreleasepool {
        NSRunningApplication *finder = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
        if ([finder.bundleIdentifier isEqualToString:@"com.apple.finder"]) {
            [finder activateWithOptions:NSApplicationActivateIgnoringOtherApps];
        }
    }
}
