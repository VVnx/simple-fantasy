import type {ReactNode} from 'react';
import ToolNavigation, {type ToolTab} from './tool-navigation';

export default function ToolShell({active, children}: {active: ToolTab; children: ReactNode}) {
  return <main className="media-tool-page">
    <header className="site-header">
      <a className="brand" href="/"><span className="brand-mark">a<span>t</span></span><strong>ALL TIMELINE</strong></a>
      <ToolNavigation active={active}/>
    </header>
    {children}
  </main>;
}
