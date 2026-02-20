import { IdleResetProvider } from "@/components/idle-reset-provider";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <IdleResetProvider>{children}</IdleResetProvider>;
}
