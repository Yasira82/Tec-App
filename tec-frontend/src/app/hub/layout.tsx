import { ReactNode } from 'react';
import '@/styles/tec-design-tokens.css';
import { RefApply } from '@/components/referral/RefApply';

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Apply any invite code captured before login, once authenticated */}
      <RefApply />
      {children}
    </>
  );
}
