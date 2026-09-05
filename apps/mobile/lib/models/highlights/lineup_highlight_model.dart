import 'package:flutter/material.dart';

class LineupHighlightModel {
  final String nome;
  final String url;
  final Color cor;
  final double avaliacao;
  final int nivelPreco;

  LineupHighlightModel({
    required this.nome,
    required this.url,
    required this.cor,
    required this.avaliacao,
    required this.nivelPreco,
  });
}
