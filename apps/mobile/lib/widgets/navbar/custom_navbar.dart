import 'dart:io';

import 'package:flutter/material.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:provider/provider.dart';

class CustomNavbar extends StatelessWidget {
  final int? currentIndex;
  final ValueChanged<int>? onTap;

  static const _heartIndex = 2;

  const CustomNavbar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final unreadCount = context.watch<NotificationProvider>().unreadCount;

    final items = [
      Icons.home_rounded,
      Icons.search_rounded,
      Icons.favorite_outline_rounded,
      Icons.person_outline_rounded,
    ];

    final activeItems = [
      Icons.home_rounded,
      Icons.search_rounded,
      Icons.favorite_rounded,
      Icons.person_rounded,
    ];

    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, bottom: 12, top: 8),
      child: Container(
        height: (Platform.isIOS ? 70 : 65),
        decoration: BoxDecoration(
          color: context.colors.navy,
          borderRadius: const BorderRadius.all(Radius.circular(70)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(items.length, (index) {
            final isActive = index == currentIndex;
            return GestureDetector(
              onTap: () => onTap!(index),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 1000),
                curve: Curves.easeOutBack,
                width: isActive ? (Platform.isIOS ? 52 : 45) : 48,
                height: isActive ? (Platform.isIOS ? 52 : 45) : 48,
                decoration: isActive
                    ? BoxDecoration(
                        color: context.colors.ambar,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: context.colors.ambar.withOpacity(0.4),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      )
                    : null,
                child: _buildIcon(
                  context: context,
                  index: index,
                  isActive: isActive,
                  items: items,
                  activeItems: activeItems,
                  unreadCount: unreadCount,
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _buildIcon({
    required BuildContext context,
    required int index,
    required bool isActive,
    required List<IconData> items,
    required List<IconData> activeItems,
    required int unreadCount,
  }) {
    final icon = Icon(
      isActive ? activeItems[index] : items[index],
      // Ícone ativo fica sobre o círculo context.colors.ambar (cor de marca,
      // fixa nos dois temas), então continua branco; o inativo fica direto
      // sobre context.colors.navy, que agora varia por tema.
      color: isActive ? Colors.white : context.colors.textMuted,
      size: Platform.isIOS ? 26 : 24,
    );

    if (index != _heartIndex || unreadCount <= 0) {
      return icon;
    }

    final label = unreadCount > 99 ? '99+' : '$unreadCount';

    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        icon,
        Positioned(
          top: 2,
          right: -2,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            decoration: BoxDecoration(
              color: context.colors.brasa,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: context.colors.navy, width: 1.5),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
