import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class LocationPickerTile extends StatelessWidget {
  final String? selectedLocation;
  final VoidCallback onTap;

  const LocationPickerTile({
    super.key,
    required this.selectedLocation,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          color: context.colors.noturno,
          border: Border.all(color: Colors.white10, width: 1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(Icons.location_on, color: context.colors.ambar),

            const SizedBox(width: 12),

            Expanded(
              child: Text(
                selectedLocation ?? 'Adicionar localização',
                style: TextStyle(
                  color: selectedLocation == null
                      ? Colors.white70
                      : Colors.white,
                  fontSize: 16,
                ),
              ),
            ),

            Icon(Icons.chevron_right, color: context.colors.ambar),
          ],
        ),
      ),
    );
  }
}
