import type { Metadata } from "next";
import LegalPage, { Mail, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Suporte — Vibester",
  description: "Ajuda com conta, senha, denúncia, bloqueio e exclusão de conta no Vibester.",
};

export default function SuportePage() {
  return (
    <LegalPage title="Suporte">
      <p>
        Precisa de ajuda? Escreve pra gente em <Mail />. Respondemos em até 2 dias úteis; denúncias de conteúdo
        abusivo são analisadas em até 24 horas.
      </p>

      <Section title="Esqueci minha senha">
        <p>
          Na tela de login, toque em <strong>Esqueci minha senha</strong>, informe o e-mail da conta e use o
          código de 6 dígitos que chegar para criar uma senha nova. O código vale por 10 minutos.
        </p>
      </Section>

      <Section title="Como denunciar uma publicação ou perfil">
        <p>
          Toque no menu <strong>⋯</strong> da publicação ou do perfil e escolha <strong>Denunciar</strong>.
          Quem foi denunciado não fica sabendo quem denunciou.
        </p>
      </Section>

      <Section title="Como bloquear alguém">
        <p>
          No menu <strong>⋯</strong> do perfil ou da publicação, toque em <strong>Bloquear perfil</strong>.
          Para desfazer, vá em <strong>Você → Ajustes → Contas bloqueadas</strong>.
        </p>
      </Section>

      <Section title="Como excluir minha conta">
        <p>
          Vá em <strong>Você → Ajustes → Excluir conta</strong> e confirme sua senha. A exclusão é definitiva.
          Se não conseguir entrar no app, peça a exclusão por <Mail /> usando o e-mail cadastrado.
        </p>
      </Section>

      <Section title="Uma informação de evento ou lugar está errada">
        <p>Mande o nome do lugar ou evento e o que está errado para <Mail />.</p>
      </Section>
    </LegalPage>
  );
}
