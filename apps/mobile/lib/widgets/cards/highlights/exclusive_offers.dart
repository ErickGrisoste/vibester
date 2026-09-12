import 'package:flutter/material.dart';
import 'package:mobile/models/place/exclusive_offers_model.dart';
import 'package:mobile/theme/theme_extensions.dart';

class ExclusiveOffers extends StatefulWidget {
  final ExclusiveOffersModel offer;

  const ExclusiveOffers({super.key, required this.offer});

  @override
  State<ExclusiveOffers> createState() => _ExclusiveOffersState();
}

class _ExclusiveOffersState extends State<ExclusiveOffers> {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: context.colors.navy,
        borderRadius: BorderRadius.circular(60),
        border: Border.all(color: context.colors.brasa.withAlpha(60), width: 2),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(55),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(55),
          splashColor: context.colors.ambar,
          child: Stack(
            children: [
              Padding(
                padding: EdgeInsets.only(
                  left: 15,
                  top: 15,
                  bottom: 15,
                  right: 15,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: context.colors.darkGrey,
                          width: 1,
                        ),
                      ),
                      child: ClipOval(
                        child: SizedBox(
                          height: 85,
                          width: 85,
                          child: Image.asset(
                            widget.offer.imgURL,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${widget.offer.desconto}% OFF',
                            style: TextStyle(
                              color: context.colors.ambar,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.offer.lugar,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: context.colors.textPrimary,
                              fontSize: 23,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            widget.offer.condicao,
                            style: TextStyle(
                              color: context.colors.textDisabled,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
