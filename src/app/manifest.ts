import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular com nome e ícone da Arthea.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arthea Finanças",
    short_name: "Arthea",
    description: "Finanças a dois: cada gasto é meu, seu ou nosso.",
    lang: "pt-BR",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F1F4F4",
    theme_color: "#0D4A4A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
