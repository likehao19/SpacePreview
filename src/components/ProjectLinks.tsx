import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { desktop } from '../lib/bridge';

export default function ProjectLinks() {
  const [error, setError] = useState('');
  return (
    <div className="about-project">
      <div className="about-project-links">
        {(
          [
            ['repository', 'GitHub 项目', 'https://github.com/likehao19/SpacePreview'],
            ['releases', '版本更新记录', 'https://github.com/likehao19/SpacePreview/releases'],
          ] as const
        ).map(([page, label, href]) => (
          <a
            key={page}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (!desktop) return;
              event.preventDefault();
              setError('');
              void invoke('open_project_page', { page }).catch(() =>
                setError('无法打开浏览器，请手动访问 github.com/likehao19/SpacePreview。'),
              );
            }}
          >
            {label} ↗
          </a>
        ))}
      </div>
      {error && (
        <p className="update-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
