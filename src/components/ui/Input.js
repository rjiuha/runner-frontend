// src/components/ui/Input.js
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';

/**
 * Инпут с встроенным показом ошибки.
 * Ошибка ПОД полем, а не в Alert: пользователь видит, какое именно
 * поле не так, и не теряет введённые данные.
 */
export default function Input({ error, secondary = false, style, ...props }) {
    return (
        <View style={styles.wrapper}>
            <TextInput
                style={[
                    styles.input,
                    secondary && styles.secondary,
                    !!error && styles.inputError,
                    style,
                ]}
                placeholderTextColor="#d5d5d5"
                {...props}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginVertical: spacing.sm },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        color: colors.textOnDark,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.inputBg,
    },
    secondary: { backgroundColor: colors.inputBgAlt },
    inputError: { borderColor: colors.danger, borderWidth: 2 },
    error: { color: colors.danger, fontSize: font.tiny, marginTop: spacing.xs, marginLeft: spacing.xs },
});