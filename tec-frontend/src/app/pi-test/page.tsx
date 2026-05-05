// Server Component — no 'use client'
// Guard: returns 404 unless NEXT_PUBLIC_PI_TEST_ENABLED=true
import { notFound } from 'next/navigation';
import { PiTestClient } from './PiTestClient';

export default function PiTestPage() {
  if (process.env.NEXT_PUBLIC_PI_TEST_ENABLED !== 'true') {
    notFound();
  }
  return <PiTestClient />;
}

ده الكود الي في الريبو
