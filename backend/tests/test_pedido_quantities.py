import unittest
from decimal import Decimal

from app.services.pedido_service import (
    _calculate_order_quantity,
    _commercial_quantity_label,
)


class PedidoQuantityTests(unittest.TestCase):
    def test_rounds_commercial_units_up_and_reports_covered_content(self):
        result = _calculate_order_quantity(
            Decimal("1500"),
            "unidades",
            Decimal("900"),
            "cc",
        )

        self.assertEqual(result["cantidad_final"], Decimal("2"))
        self.assertEqual(result["cantidad_contenido_final"], Decimal("1800"))
        self.assertEqual(result["unidad_contenido"], "cc")

    def test_rounds_bulk_quantities_up_to_whole_units(self):
        result = _calculate_order_quantity(Decimal("1.5"), "kg")

        self.assertEqual(result["cantidad_final"], Decimal("2"))
        self.assertIsNone(result["cantidad_contenido_final"])

    def test_keeps_whole_bulk_quantities_untouched(self):
        result = _calculate_order_quantity(Decimal("3"), "litros")

        self.assertEqual(result["cantidad_final"], Decimal("3"))
        self.assertIsNone(result["cantidad_contenido_final"])

    def test_formats_covered_content_in_a_contextual_unit(self):
        label = _commercial_quantity_label(
            {
                "cantidad_total": "2.00",
                "cantidad_contenido_total": "1800.00",
                "unidad_contenido": "cc",
            }
        )

        self.assertEqual(label, "2.00 (1.8 litros)")


if __name__ == "__main__":
    unittest.main()
