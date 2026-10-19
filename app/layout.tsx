import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';
import './globals.css';
export const metadata:Metadata={
  metadataBase:new URL(SITE_URL),
  title:SITE_NAME,
  description:SITE_DESCRIPTION,
  applicationName:SITE_NAME,
  icons:{icon:'/favicon.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body>{children}</body></html>;}
