<h1 align="center">SpacePreview</h1>

<p align="center"><strong>로컬 우선 파일 미리보기. 파일을 선택하고 Space 키로 내용을 확인하세요.</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  한국어
</p>

<p align="center">
  <a href="https://github.com/likehao19/SpacePreview/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/SpacePreview?display_name=tag&sort=semver" alt="최신 릴리스" /></a>
  <a href="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml"><img src="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml/badge.svg" alt="빌드 상태" /></a>
  <a href="https://github.com/likehao19/SpacePreview/releases"><img src="https://img.shields.io/github/downloads/likehao19/SpacePreview/total" alt="다운로드 수" /></a>
  <a href="https://github.com/likehao19/SpacePreview/stargazers"><img src="https://img.shields.io/github/stars/likehao19/SpacePreview?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 라이선스" /></a>
</p>

<p align="center">
  <a href="https://spacepreview.likh.cn/">웹사이트</a> ·
  <a href="https://github.com/likehao19/SpacePreview/releases/latest">다운로드</a> ·
  <a href="https://github.com/likehao19/SpacePreview/issues">문제 보고</a>
</p>

<p align="center">
  <img src="website/assets/preview-archive.png" alt="ZIP 디렉터리와 내부 이미지를 미리 보는 SpacePreview" width="1000" />
</p>

## 앱을 매번 열지 않고 파일 내용 확인하기

SpacePreview는 로컬 파일 미리보기 도구입니다. Windows 탐색기나 바탕 화면, macOS Finder에서 파일을 선택하고 Space 키를 누르면 내용을 볼 수 있습니다. 다시 누르면 원래 작업으로 돌아갑니다. 문서, 이미지, 코드, 표, 압축 파일을 하나의 창에서 확인하므로 잠깐 보기 위해 편집기 전체를 실행할 필요가 없습니다.

- **로컬 우선** — 읽기 전용으로 미리 보고, 원본 파일을 변경하거나 내용을 업로드하지 않습니다.
- **빠른 확인** — PDF는 화면 근처의 페이지만 렌더링하고 ZIP 항목은 필요할 때 읽습니다. 파일을 전환하거나 창을 닫으면 이전 작업을 취소합니다.
- **다양한 콘텐츠** — 일반 문서, 이미지, 코드, 압축 파일 및 일부 전문 형식을 처리합니다. 기능과 제한은 형식마다 다릅니다.
- **여러 운영체제** — Windows, macOS, Linux 설치 파일을 제공합니다. Linux는 드래그 앤 드롭 또는 `Ctrl+O`로 열며, 파일 관리자 Space 연동은 아직 지원하지 않습니다.

## 두 가지 확인 방식

<table>
  <tr>
    <td width="50%"><img src="website/assets/preview-word.png" alt="페이지 미리보기와 읽기 탐색" /></td>
    <td width="50%"><img src="website/assets/preview-code.png" alt="소스 보기와 코드 접기" /></td>
  </tr>
  <tr>
    <td align="center"><strong>페이지 미리보기와 읽기 탐색</strong><br />문서 페이지, 이미지, 표를 보고 개요로 필요한 장을 찾습니다.</td>
    <td align="center"><strong>소스 보기와 코드 접기</strong><br />강조 표시, 검색, 조건에 따른 코드 접기로 코드·설정·텍스트를 확인합니다.</td>
  </tr>
</table>

## SpacePreview의 기능

### 문서 읽기

- PDF 연속 스크롤, 확대·축소, 텍스트 선택 및 복사, 검색, 내장 목차. 스캔 PDF의 OCR은 제공하지 않습니다.
- OFD 문서(중국 전자 영수증 등)는 보이는 페이지만 그리며 텍스트, 벡터 도형, 이미지, 템플릿, 주석, 인장 표시를 지원하고 전체 검색이 가능합니다. 서명 유효성은 검증하지 않습니다.
- Word 페이지, 이미지, 표, 제목 개요와 텍스트 보기 전환. 복잡한 레이아웃은 원본과 다를 수 있으며, 구형 DOC는 텍스트만 표시합니다.
- Markdown 개요, 작업 목록, 표, 코드 강조 표시와 RTF, OpenDocument, EPUB, FB2 읽기.
- Windows에서 설치 및 정품 인증된 Microsoft PowerPoint를 이용한 정적 페이지 미리보기. 다른 환경에서는 텍스트를 표시하며 프레젠테이션 애니메이션은 재생하지 않습니다.

### 코드와 전문 콘텐츠 확인

- 구문 강조, 전체 텍스트 검색, 인코딩 선택, 글자 크기 조절. JSON/XML 등의 구조화된 코드는 크기 및 줄 수 제한 내에서 접을 수 있습니다.
- 로컬 HTML의 웹페이지·읽기·소스 모드. 제한 범위 내에서 같은 디렉터리와 하위 디렉터리의 정적 리소스를 읽으며 스크립트는 실행하지 않습니다.
- DXF 도면과 STL, OBJ, GLB, STEP 등의 형상 보기. 완전한 CAD 편집 기능이나 모든 형식 버전의 호환성을 보장하지 않습니다.
- 개별 로컬 엔진으로 일부 전문 이미지, SQLite, 글꼴, 메일, 다이어그램, 애니메이션을 표시합니다. RAW 변형 및 디자인 파일의 내장 미리보기에는 제한이 있습니다.

### 디렉터리와 내용 탐색

- 폴더 계층을 펼치고 내부의 지원 파일을 계속 미리 봅니다.
- ZIP, TAR, 7Z, RAR 등 지원 압축 파일의 전체 내용을 먼저 풀지 않고 디렉터리와 항목을 탐색합니다.
- 표의 여러 시트 또는 가상 스크롤, SQLite 레코드의 페이지별 조회. 매크로를 실행하거나 수식을 다시 계산하지 않습니다.
- 같은 디렉터리의 파일 전환, 파일 드롭, 파일 선택 대화 상자를 제공합니다.

### 사용 방식 맞춤 설정

- 밝게·어둡게·시스템 테마와 읽기 글꼴, 글자 크기, 페이지 배율.
- Windows와 macOS에서 별도로 저장하는 미리보기 단축키. 기본 Space 키로 초기화할 수 있습니다.
- 선택적 로그인 시 실행, 포커스를 잃으면 닫기, 트레이 또는 메뉴 막대 상주.
- 앱 내 업데이트 확인. Linux AppImage는 앱 내 업데이트를 지원하며 DEB 사용자는 새 패키지를 내려받아 업데이트합니다.

자세한 내용과 제한은 [미리보기 안내](docs/PREVIEW-GUIDE.md), [형식 목록](docs/FORMAT_PARITY.md), [형식 점검 기록](docs/WEBSITE-FORMAT-AUDIT.md)을 참고하세요. 형식 등록이 모든 변형의 동작을 보장하지는 않습니다. 최근 샘플 검증 환경은 Windows Edge이며 macOS/Linux 실제 기기 검증은 추가로 필요합니다.

## 다운로드

| 플랫폼 | 패키지 | 아키텍처 |
| --- | --- | --- |
| Windows | [설치 프로그램](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-windows-x64-setup.exe) | x64 |
| macOS | [Apple Silicon DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-macos-arm64.dmg) | ARM64 |
| macOS | [Intel DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-macos-x64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-linux-x64.AppImage) · [DEB](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-linux-x64.deb) | x86_64 |

직접 링크는 v0.10.17용입니다. [웹사이트](https://spacepreview.likh.cn/)는 최신 릴리스를 자동으로 확인합니다. 업데이트 내용과 이전 버전은 [GitHub Releases](https://github.com/likehao19/SpacePreview/releases)에서 확인하세요.

## 설치

### Windows

`SpacePreview-0.10.17-windows-x64-setup.exe`를 내려받아 설치 안내를 따르세요. 현재 Windows 10/11 x64를 지원하며 Microsoft Edge WebView2 Runtime이 필요합니다.

실행 후 탐색기나 바탕 화면에서 파일을 선택하고 `Space`를 누르세요. 창을 닫아도 앱은 트레이에 남습니다. 완전히 종료하려면 트레이 메뉴를 사용하세요.

### macOS

Mac 프로세서에 맞는 DMG를 열고 **SpacePreview**를 **응용 프로그램** 폴더로 드래그하세요.

설치 파일은 임시 서명을 사용하며 Apple Developer ID 서명과 공증은 아직 적용되지 않았습니다. 첫 실행이 Gatekeeper에 차단되면 **시스템 설정 → 개인정보 보호 및 보안**에서 **확인 없이 열기** 항목을 확인하세요.

Finder 미리보기에는 손쉬운 사용 및 Finder 자동화 권한이 필요합니다. 권한, 빌드, 기기 검증은 [MACOS.md](MACOS.md)를 참고하세요.

### Linux

`uname -m`으로 아키텍처를 확인하세요. 현재 패키지는 `x86_64`용입니다.

- 호환되는 Debian/Ubuntu 계열 배포판은 **DEB**를 선택하세요.
- 다른 호환 배포판은 **AppImage**를 선택하고 먼저 실행 권한을 부여하세요.

```bash
# AppImage
chmod +x SpacePreview-0.10.17-linux-x64.AppImage
./SpacePreview-0.10.17-linux-x64.AppImage

# Debian 계열
sudo apt install ./SpacePreview-0.10.17-linux-x64.deb
```

파일을 드래그하거나 `Ctrl+O`로 여세요. Linux 파일 관리자 Space 연동, RPM, ARM64 패키지는 현재 제공하지 않습니다.

## 키보드 단축키

| 기능 | Windows | macOS |
| --- | --- | --- |
| 미리보기 열기 / 닫기 | `Space` | `Space` |
| 메뉴·설정·미리보기 닫기 | `Esc` | `Esc` |
| 텍스트 미리보기 요청 / 전환 | `Shift+Space` | `Shift+Space` |
| 이전 / 다음 파일 | `←` / `→` | `←` / `→` |
| 파일 선택 | `Ctrl+O` | `⌘O` |
| 경로 복사 | `Ctrl+Shift+C` | `⌘⇧C` |
| 글자 크기·페이지 배율 조절 | `Ctrl++` / `Ctrl+-` | `⌘+` / `⌘-` |
| 마우스 휠로 크기·배율 조절 | `Ctrl+휠` | `⌘+휠` |
| 기본 앱으로 열기 | `Enter` | `Enter` |

**환경 설정 → 단축키**에서 미리보기 키를 바꿀 수 있습니다. 입력 필드, 미디어 컨트롤, 포커스된 버튼은 원래 키 동작을 유지합니다. 브라우저 파일과 압축 파일 내부 항목은 경로 대신 이름을 복사합니다. 기본 앱으로 열기는 실행 파일이나 스크립트를 실행하지 않습니다. [미리보기 안내](docs/PREVIEW-GUIDE.md)를 참고하세요.

## 개인정보와 로컬 데이터

SpacePreview는 파일 내용을 업로드하거나 원본을 변경하지 않습니다. 파일은 원래 위치에 남습니다. 설정은 로컬에 저장되며 미리보기 엔진이 로컬 캐시를 만들 수 있습니다. 업데이트 확인은 배포 서버에 접속합니다.

문서 스크립트, Office 매크로, Notebook 셀은 실행하지 않습니다. 기본 단일 파일 제한은 **256 MB**이며 **16–1024 MB**로 조절할 수 있습니다. 형식별 추가 제한도 있습니다. Web Worker는 운영체제 수준의 샌드박스가 아니며 프로세스별 CPU/메모리 격리를 제공하지 않습니다. [구조와 보안 경계](docs/PREVIEW-GUIDE.md#架构与安全边界)를 참고하세요.

## 소스에서 빌드

### 요구 사항

- Node.js **22.13+**와 npm.
- Rust stable.
- Windows: Visual Studio C++ Build Tools, Windows SDK, WebView2. macOS: Xcode Command Line Tools. [MACOS.md](MACOS.md) 참고.

```bash
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

프로젝트 검사와 데스크톱 설치 파일 빌드:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

브라우저 개발은 `npm run dev`, 엔진 회귀 검사는 `npm run test:preview`, Mac의 유니버설 빌드는 `npm run desktop:build:mac`을 사용하세요. [TESTING.md](TESTING.md)와 [업데이트 안내](docs/UPDATING.md)를 참고하세요. 독립 HTML/CSS/JS 웹사이트는 [website/](website/)에 있으며 사용법은 해당 [README](website/README.md)에 있습니다.

## 기술 스택

Tauri 2와 Rust, React 19와 TypeScript, PDF.js, docx-preview, highlight.js 및 이미지·압축 파일·데이터베이스·모델용 로컬 JS/WASM 엔진으로 구성되어 있습니다.

## 기여

재현 가능한 버그나 구체적인 기능 제안은 [GitHub Issues](https://github.com/likehao19/SpacePreview/issues)에 올려 주세요. OS, 앱 버전, 형식, 재현 단계를 포함해 주세요. 코드를 제출하기 전에 관련 프런트엔드 테스트, 프로덕션 빌드, Rust 검사를 실행하세요. 소스 파일은 BOM 없는 UTF-8입니다.

커뮤니티: [LinuxDo](https://linux.do/). [개발 이력](docs/HISTORY.md)과 [릴리스 노트](RELEASE-NOTES.md)도 참고하세요.

## 기여자

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/likehao19">
        <img src="https://avatars.githubusercontent.com/u/96912988?v=4" width="72" height="72" alt="likehao19" /><br />
        <sub><strong>likehao19</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/StackTao">
        <img src="https://avatars.githubusercontent.com/u/243470334?v=4" width="72" height="72" alt="StackTao" /><br />
        <sub><strong>StackTao</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/973212983">
        <img src="https://avatars.githubusercontent.com/u/104485059?v=4" width="72" height="72" alt="973212983" /><br />
        <sub><strong>973212983</strong></sub>
      </a>
    </td>
  </tr>
</table>

## Star 추이

<picture>
  <img alt="SpacePreview Star 이력 차트" src="https://api.star-history.com/svg?repos=likehao19/SpacePreview&type=Date" />
</picture>

## 라이선스

SpacePreview는 [MIT 라이선스](LICENSE)로 공개됩니다. 타사 의존성의 라이선스와 고지는 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)를 참고하세요.
