import type { Metadata } from "next";
import LegalPage, { List, Mail, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso — Vibester",
  description: "Regras de uso do Vibester, conteúdo publicado pelos usuários, denúncia, bloqueio e moderação.",
};

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="14 de setembro de 2026">
      <p>
        Estes Termos regem o uso do aplicativo Vibester e do site vibester.com.br. Ao criar uma conta você
        declara que leu e aceita estes Termos e a <a href="/privacidade" className="text-fire underline underline-offset-4">Política de Privacidade</a>.
      </p>

      <Section title="1. Quem pode usar">
        <p>
          O Vibester é para pessoas com <strong>18 anos ou mais</strong>. Ao se cadastrar você confirma ter
          essa idade e informar dados verdadeiros. Contas de menores de idade serão encerradas.
        </p>
      </Section>

      <Section title="2. Sua conta">
        <p>
          Você é responsável pela sua senha e por tudo o que acontecer na sua conta. Não compartilhe o acesso.
          Se suspeitar de uso indevido, redefina a senha pelo app e avise a gente em <Mail />.
        </p>
      </Section>

      <Section title="3. Conteúdo que você publica">
        <p>
          Fotos, vídeos, legendas, bio e demais conteúdos continuam sendo seus. Ao publicar, você concede ao
          Vibester uma licença não exclusiva e gratuita para armazenar, exibir e distribuir esse conteúdo dentro
          do serviço, só para fazê-lo funcionar. A licença termina quando você exclui o conteúdo ou a conta.
        </p>
        <p>Você só pode publicar o que tem direito de publicar, incluindo a imagem de outras pessoas.</p>
      </Section>

      <Section title="4. Tolerância zero com conteúdo abusivo">
        <p>
          O Vibester não tolera conteúdo ou comportamento abusivo. É proibido publicar, enviar ou promover:
        </p>
        <List
          items={[
            "Assédio, bullying, ameaças ou incentivo à violência.",
            "Discurso de ódio ou discriminação por raça, etnia, religião, gênero, orientação sexual, deficiência ou origem.",
            "Nudez, conteúdo sexual explícito ou qualquer conteúdo sexual envolvendo menores de idade.",
            "Venda ou incentivo ao uso de drogas ilícitas e qualquer atividade ilegal.",
            "Spam, golpes, perfis falsos ou se passar por outra pessoa ou marca.",
            "Exposição de dados pessoais de terceiros sem autorização.",
            "Conteúdo que viole direitos autorais, marcas ou a lei brasileira.",
          ]}
        />
      </Section>

      <Section title="5. Denúncia, bloqueio e moderação">
        <List
          items={[
            <>
              <strong>Denunciar:</strong> no menu ⋯ de qualquer publicação ou perfil, toque em Denunciar e
              escolha o motivo. Quem foi denunciado não fica sabendo quem denunciou.
            </>,
            <>
              <strong>Bloquear:</strong> no mesmo menu, toque em Bloquear. Vocês deixam de se seguir, as
              publicações somem do seu feed e o perfil não consegue mais te seguir. Dá para desfazer em
              Ajustes → Contas bloqueadas.
            </>,
            <>
              <strong>Moderação:</strong> analisamos as denúncias em até <strong>24 horas</strong>. Conteúdo
              que viole estes Termos é removido, e a conta responsável pode ser suspensa ou encerrada, sem
              aviso prévio nos casos graves.
            </>,
          ]}
        />
      </Section>

      <Section title="6. Eventos, lugares e links de terceiros">
        <p>
          Informações de eventos e estabelecimentos (horários, endereços, line-up, movimento) vêm dos
          organizadores, dos próprios lugares e de fontes públicas, e podem mudar sem aviso. Confirme com o
          organizador antes de ir. Links de ingresso e mapas levam a serviços de terceiros, que têm termos
          próprios. O Vibester não vende ingressos e não se responsabiliza pelos eventos.
        </p>
      </Section>

      <Section title="7. Uso responsável">
        <p>
          Vida noturna envolve escolhas pessoais. Beba com moderação, não dirija após consumir álcool e respeite
          as regras dos lugares. É proibido usar o Vibester para organizar atividades ilegais.
        </p>
      </Section>

      <Section title="8. Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento em Você → Ajustes → Excluir conta. Podemos suspender
          ou encerrar contas que violem estes Termos ou a lei.
        </p>
      </Section>

      <Section title="9. Limitação de responsabilidade">
        <p>
          O serviço é oferecido como está. Trabalhamos para mantê-lo disponível e seguro, mas não garantimos
          funcionamento ininterrupto. O Vibester não responde pelo conteúdo publicado por usuários, mas age para
          removê-lo quando viola estes Termos ou a lei.
        </p>
      </Section>

      <Section title="10. Mudanças e lei aplicável">
        <p>
          Podemos atualizar estes Termos; mudanças relevantes serão avisadas no app. Estes Termos seguem as leis
          da República Federativa do Brasil. Dúvidas: <Mail />.
        </p>
      </Section>
    </LegalPage>
  );
}
