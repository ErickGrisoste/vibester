import type { Metadata } from "next";
import LegalPage, { List, Mail, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade — Vibester",
  description: "Quais dados o Vibester coleta, para quê, com quem compartilha e como excluir sua conta.",
};

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="14 de setembro de 2026">
      <p>
        Esta política explica quais dados pessoais o aplicativo Vibester e o site vibester.com.br
        tratam, para quê, com quem são compartilhados e como você controla e exclui esses dados.
        Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <Section title="1. Quem é responsável pelos seus dados">
        <p>
          O Vibester é o controlador dos dados tratados no app. Para qualquer assunto de privacidade,
          incluindo o exercício dos seus direitos, fale com a gente em <Mail />.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <p>
          <strong>Dados que você informa ao criar a conta:</strong>
        </p>
        <List
          items={[
            "Nome e nome de usuário (públicos no seu perfil).",
            "E-mail, usado para login, códigos de verificação e avisos de segurança.",
            "Senha, guardada apenas de forma criptografada (hash); ninguém da equipe tem acesso a ela.",
            "Data de nascimento, usada para confirmar que você tem 18 anos ou mais.",
          ]}
        />
        <p>
          <strong>Conteúdo que você cria no app:</strong>
        </p>
        <List
          items={[
            "Foto de perfil e bio.",
            "Publicações: fotos, vídeos, legendas e o lugar que você marcar.",
            "Curtidas, pessoas que você segue, check-ins em eventos, perfis que você bloqueou e denúncias que você enviou.",
          ]}
        />
        <p>
          <strong>Localização:</strong> só quando você permite, e só enquanto usa o app. Ela é enviada no
          momento da busca para listar lugares e eventos perto de você. Não guardamos um histórico da sua
          localização. Fotos e vídeos têm os metadados de localização (EXIF) removidos no próprio aparelho
          antes do envio.
        </p>
        <p>
          <strong>Dados técnicos:</strong> endereço IP, data e hora das requisições e informações básicas
          do dispositivo aparecem nos registros de acesso dos nossos servidores, usados para segurança,
          prevenção de abuso e diagnóstico de falhas.
        </p>
        <p>
          <strong>O que não coletamos:</strong> não usamos publicidade, não rastreamos você em outros apps
          ou sites, não usamos o identificador de publicidade do aparelho (IDFA) e não acessamos contatos,
          microfone ou câmera fora das telas em que você mesmo os aciona.
        </p>
      </Section>

      <Section title="3. Para que usamos os dados">
        <List
          items={[
            "Criar e manter sua conta e autenticar seu acesso (execução do contrato).",
            "Mostrar seu perfil e suas publicações, montar o feed de quem você segue e listar lugares e eventos próximos (execução do contrato).",
            "Enviar códigos de verificação, redefinição de senha e alertas de tentativas de acesso (execução do contrato e legítimo interesse em segurança).",
            "Analisar denúncias, remover conteúdo que viole os Termos de Uso e suspender contas abusivas (legítimo interesse e cumprimento de obrigação legal).",
            "Confirmar a idade mínima de 18 anos (legítimo interesse e proteção de menores).",
          ]}
        />
      </Section>

      <Section title="4. O que é público">
        <p>
          Nome, nome de usuário, foto de perfil, bio, contagem de seguidores e publicações ficam visíveis para
          outras pessoas que usam o Vibester. Perfis que você bloqueou deixam de conseguir te seguir. E-mail,
          data de nascimento e localização nunca são exibidos.
        </p>
      </Section>

      <Section title="5. Com quem compartilhamos">
        <p>Não vendemos nem alugamos dados pessoais. Compartilhamos apenas com operadores que prestam serviços para o Vibester:</p>
        <List
          items={[
            "Provedores de hospedagem e banco de dados, onde rodam nossos servidores.",
            "Cloudflare (armazenamento R2), onde ficam fotos e vídeos enviados.",
            "Provedor de envio de e-mail, para códigos e avisos.",
          ]}
        />
        <p>
          Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.
          Links de compra de ingresso levam ao site do organizador do evento, que tem política própria.
        </p>
      </Section>

      <Section title="6. Por quanto tempo guardamos">
        <p>
          Mantemos os dados enquanto sua conta existir. Códigos de verificação expiram em até 10 minutos.
          Registros técnicos de acesso são mantidos pelo prazo necessário à segurança e ao cumprimento do
          Marco Civil da Internet (Lei nº 12.965/2014), que exige guarda de registros de acesso por 6 meses.
        </p>
      </Section>

      <Section title="7. Como excluir sua conta">
        <p>
          No app, vá em <strong>Você → Ajustes → Excluir conta</strong> e confirme sua senha. A exclusão é
          definitiva e remove sua credencial de acesso, seu perfil, suas publicações, fotos e vídeos, curtidas,
          comentários, relações de seguir, bloqueios, denúncias feitas por você e notificações. A remoção nos
          nossos sistemas começa na hora e pode levar alguns minutos para terminar. Registros técnicos de
          acesso seguem apenas o prazo legal descrito acima.
        </p>
        <p>
          Se não conseguir acessar o app, peça a exclusão por <Mail /> a partir do e-mail cadastrado.
        </p>
      </Section>

      <Section title="8. Seus direitos">
        <p>
          Pela LGPD você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir anonimização,
          bloqueio ou eliminação, portabilidade, informação sobre compartilhamento e revogar consentimentos.
          Nome, usuário, foto e bio podem ser editados no próprio app; para os demais pedidos, escreva para <Mail />.
          Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Section>

      <Section title="9. Segurança">
        <p>
          Toda comunicação com nossos servidores é criptografada (HTTPS). A sessão do app fica no armazenamento
          seguro do sistema (Keychain no iOS). Senhas e códigos são guardados apenas como hash. Nenhum sistema é
          100% imune; se identificarmos um incidente relevante, avisaremos você e a ANPD conforme a lei.
        </p>
      </Section>

      <Section title="10. Idade mínima">
        <p>
          O Vibester é destinado a pessoas com 18 anos ou mais. Não permitimos cadastro de menores. Se souber de
          uma conta de menor de idade, denuncie no app ou escreva para <Mail />.
        </p>
      </Section>

      <Section title="11. Mudanças nesta política">
        <p>
          Podemos atualizar esta política. Mudanças relevantes serão avisadas no app antes de entrarem em vigor.
          A data no topo indica a versão atual.
        </p>
      </Section>
    </LegalPage>
  );
}
