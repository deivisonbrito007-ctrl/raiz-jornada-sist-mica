import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type LembretePraticaProps = {
  titulo?: string;
  mensagem?: string;
  url?: string;
  rodape?: string;
};

/** E-mail de lembrete de prática/reflexão, no visual do Raiz. */
export function LembretePraticaEmail({
  titulo = "Sua prática está te esperando",
  mensagem = "Reserve alguns minutos hoje para a sua próxima prática.",
  url = "https://useraiz.online/app",
  rodape = "Você recebe este lembrete porque ativou os lembretes de prática no Raiz.",
}: LembretePraticaProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{mensagem}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={marca}>Raiz</Text>
          <Section style={cartao}>
            <Heading style={h1}>{titulo}</Heading>
            <Text style={texto}>{mensagem}</Text>
            <Button href={url} style={botao}>
              Abrir minha trilha
            </Button>
          </Section>
          <Hr style={linha} />
          <Text style={pe}>{rodape}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#ffffff", fontFamily: "Georgia, 'Times New Roman', serif" };
const container = { padding: "24px", maxWidth: "560px" };
const marca = {
  fontSize: "14px",
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "#5b6f5a",
  margin: "0 0 16px",
};
const cartao = {
  backgroundColor: "#f4f6f1",
  borderRadius: "20px",
  padding: "28px 24px",
};
const h1 = { fontSize: "22px", lineHeight: "1.3", color: "#1f3d2b", margin: "0 0 12px" };
const texto = { fontSize: "16px", lineHeight: "1.6", color: "#3d4a3d", margin: "0 0 22px" };
const botao = {
  backgroundColor: "#1f3d2b",
  borderRadius: "999px",
  color: "#ffffff",
  fontSize: "15px",
  padding: "13px 26px",
  textDecoration: "none",
  display: "inline-block",
};
const linha = { borderColor: "#e2e7dd", margin: "24px 0 12px" };
const pe = { fontSize: "12px", lineHeight: "1.5", color: "#7b8a78", margin: 0 };

export default LembretePraticaEmail;
