import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default function ParticipationsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
