import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Fantasy - All Timeline',description:'输入球员姓名，对比 NBA 常规赛与季前赛 Yahoo Fantasy 11 CAT 场均数据。'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body>{children}</body></html>;}
