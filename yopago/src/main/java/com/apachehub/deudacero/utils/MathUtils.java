package com.apachehub.deudacero.utils;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class MathUtils {

    /**
     * Redondea un número double a 2 decimales
     */
    public static double roundToTwoDecimals(double value) {
        BigDecimal bd = BigDecimal.valueOf(value);
        bd = bd.setScale(2, RoundingMode.HALF_UP);
        return bd.doubleValue();
    }
}