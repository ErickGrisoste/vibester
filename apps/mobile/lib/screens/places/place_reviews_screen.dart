import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/event/review_card.dart';
import 'package:mobile/widgets/indicators/review_indicator.dart';

class PlaceReviewsScreen extends StatefulWidget {
  final PlaceModel place;
  const PlaceReviewsScreen({super.key, required this.place});

  @override
  State<PlaceReviewsScreen> createState() => _PlaceReviewsScreenState();
}

class _PlaceReviewsScreenState extends State<PlaceReviewsScreen> {
  int _filtroSelecionado = 0;

  Widget _buildFiltroBtn(String label, int index) {
    final selecionado = _filtroSelecionado == index;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 1000),
      curve: Curves.easeOutBack,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.all(Radius.circular(19)),
        border: selecionado
            ? Border.all(color: context.colors.border, width: 0)
            : Border.all(color: context.colors.border, width: 2),
      ),
      child: SizedBox(
        width: 100,
        height: 40,
        child: FloatingActionButton(
          backgroundColor: selecionado
              ? context.colors.ambar
              : context.colors.noturno,
          onPressed: () {
            setState(() {
              _filtroSelecionado = index;
            });
          },
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: selecionado
                  ? context.colors.textPrimary
                  : context.colors.textMuted,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: SingleChildScrollView(
        child: Column(
          children: [
            ReviewIndicator(
              avaliacao: widget.place.avaliacao,
              distribuicao: widget.place.distribuicao,
              totalReviews: widget.place.qtdAvaliacoes,
            ),

            const SizedBox(height: 5),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildFiltroBtn('Mais Recentes', 0),
                _buildFiltroBtn('Positivas', 1),
                _buildFiltroBtn('Negativas', 2),
              ],
            ),

            const SizedBox(height: 5),

            ReviewCard(
              nomeUsuario: 'Fernanda Portela',
              avaliacao: 5.0,
              comentario:
                  'Vibe incrível! O som estava perfeito e o atendimento foi nota 10. Com certeza a melhor noite de SP.',
              tempo: '2 dias atrás',
            ),
            ReviewCard(
              nomeUsuario: 'Rafael Mendonça',
              avaliacao: 5.0,
              comentario:
                  'Fui numa sexta e saí de lá impressionado. DJ arrasou, bebida gelada e o pessoal super animado. Voltarei com certeza.',
              tempo: '5 dias atrás',
            ),
            ReviewCard(
              nomeUsuario: 'Camila Rocha',
              avaliacao: 4.0,
              comentario:
                  'Ambiente incrível e música boa demais. Só achei a fila pra entrar um pouco demorada, mas valeu cada minuto.',
              tempo: '1 semana atrás',
            ),
            ReviewCard(
              nomeUsuario: 'Bruno Castilho',
              avaliacao: 5.0,
              comentario:
                  'Melhor balada que já fui em anos. O line-up estava absurdo e o som te envolve do começo ao fim. Experiência única.',
              tempo: '2 semanas atrás',
            ),
            ReviewCard(
              nomeUsuario: 'Larissa Figueiredo',
              avaliacao: 4.5,
              comentario:
                  'Adorei o espaço e a energia do lugar. Atendimento rápido mesmo lotado. Só o banheiro deixou um pouco a desejar.',
              tempo: '3 semanas atrás',
            ),
            ReviewCard(
              nomeUsuario: 'Thiago Alves',
              avaliacao: 5.0,
              comentario:
                  'Já fui em várias baladas e essa é referência. Organização impecável, som de qualidade e pista que não esvazia. Top demais.',
              tempo: '1 mês atrás',
            ),
          ],
        ),
      ),
    );
  }
}
