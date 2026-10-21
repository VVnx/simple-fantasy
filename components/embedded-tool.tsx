'use client';
import {useEffect, useRef, useState} from 'react';

export default function EmbeddedTool({src, title, note}: {src:string; title:string; note:string}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1600);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node=frame.current;
    let observer:ResizeObserver|undefined;
    function observe() {
      const body=node?.contentDocument?.body;
      if (!body || node?.contentDocument?.readyState === 'loading') return;
      observer?.disconnect();
      body.style.minHeight='0';
      const resize=()=>setHeight(Math.min(50000,Math.max(700,Math.ceil(body.getBoundingClientRect().height)+4)));
      observer=new ResizeObserver(resize);
      observer.observe(body);resize();setReady(true);
    }
    // The frame can finish loading before React hydrates, so also inspect it now.
    node?.addEventListener('load',observe);observe();
    return () => {node?.removeEventListener('load',observe);observer?.disconnect();};
  }, [src]);
  return <>
    <div className="tool-context"><span>{note}</span><a href={src} target="_blank" rel="noreferrer">独立窗口打开 ↗</a></div>
    {!ready && <p role="status" className="tool-loading">正在打开{title}…</p>}
    <iframe ref={frame} src={src} title={title} className="embedded-tool" style={{height}} onLoad={()=>setReady(true)} allow="clipboard-write"/>
  </>;
}
