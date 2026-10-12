import ResearchTool from '@/components/research-tool';
// Compute defaults at request time, not during the Vercel build.
export const dynamic = 'force-dynamic';
export default function Page(){return <ResearchTool today={new Date().toISOString()}/>;}
