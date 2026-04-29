export const dynamic = 'force-dynamic';
import dynamicImport from 'next/dynamic';
const PayClient = dynamicImport(() => import('./PayClient'), { ssr: false });
export default function PayPage() { return <PayClient />; }
