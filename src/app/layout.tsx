import type { Metadata } from "next";
import { ArtheaThemeProvider } from "@/components/financas/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Arthea Finanças",
    template: "%s · Arthea Finanças",
  },
  description:
    "Arthea Finanças — finanças pessoais pra você e quem você ama. Importação de fatura por IA, conta de casal, recorrências, metas e relatórios.",
  openGraph: {
    title: "Arthea Finanças",
    description:
      "Finanças pessoais pra você e quem você ama. Importação de fatura por IA, conta de casal, recorrências, metas e relatórios.",
    siteName: "Arthea Finanças",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ArtheaThemeProvider>{children}</ArtheaThemeProvider>
      </body>
    </html>
  );
}
