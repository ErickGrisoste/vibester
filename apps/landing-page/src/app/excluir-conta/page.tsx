import type { Metadata } from "next";
import LegalPage, { List, Mail, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Excluir conta — Vibester",
  description: "Como excluir sua conta do Vibester e quais dados são apagados.",
};

/**
 * Página pública de exclusão de conta. O Google Play exige uma URL assim no
 * formulário de Segurança dos dados, acessível sem instalar o app.
 */
export default function ExcluirContaPage() {
  return (
    <LegalPage title="Excluir sua conta do Vibester" updatedAt="14 de setembro de 2026">
      <p>
        Você pode excluir sua conta do <strong>Vibester</strong> a qualquer momento. A exclusão é definitiva e não
        dá para recuperar a conta depois.
      </p>

      <Section title="Pelo app (Android e iPhone)">
        <List
          items={[
            "Abra o Vibester e entre na sua conta.",
            <>Toque em <strong>Você</strong> e depois no ícone de engrenagem (<strong>Ajustes</strong>).</>,
            <>Toque em <strong>Excluir conta</strong>, abaixo de &quot;Sair da conta&quot;.</>,
            <>Digite sua senha, toque em <strong>Excluir minha conta</strong> e confirme.</>,
          ]}
        />
      </Section>

      <Section title="Sem acesso ao app">
        <p>
          Envie um pedido para <Mail /> a partir do e-mail cadastrado na conta, com o assunto &quot;Excluir
          conta&quot;. Confirmamos que o pedido é seu e concluímos a exclusão em até 15 dias.
        </p>
      </Section>

      <Section title="O que é apagado">
        <List
          items={[
            "Credencial de acesso (e-mail e senha) e data de nascimento.",
            "Perfil: nome, nome de usuário, foto e bio.",
            "Publicações, fotos e vídeos, curtidas e comentários.",
            "Quem você segue e quem te segue, bloqueios, denúncias feitas por você e notificações.",
          ]}
        />
        <p>A remoção começa na hora e pode levar alguns minutos para terminar em todos os sistemas.</p>
      </Section>

      <Section title="O que pode ser mantido">
        <List
          items={[
            "Registros técnicos de acesso (IP, data e hora), por 6 meses, como exige o Marco Civil da Internet.",
            "Registros de check-in em eventos, sem nenhum dado que identifique você depois que o perfil é apagado.",
          ]}
        />
        <p>
          Mais detalhes na <a href="/privacidade" className="text-fire underline underline-offset-4">Política de Privacidade</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
