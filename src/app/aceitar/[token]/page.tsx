import { AceitarForm } from "./aceitar-form";

export const metadata = { title: "Aceitar convite" };

export default function AceitarPage({ params }: { params: { token: string } }) {
  return <AceitarForm token={params.token} />;
}
