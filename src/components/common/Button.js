import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../store/ThemeContext';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  small = false,
}) => {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: { backgroundColor: colors.teal },
    secondary: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.teal },
    danger: { backgroundColor: colors.error },
    success: { backgroundColor: colors.teal },
  };

  const variantTextStyles = {
    primary: { color: colors.background },
    secondary: { color: colors.textPrimary },
    outline: { color: colors.teal },
    danger: { color: colors.textLight },
    success: { color: colors.background },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variantStyles[variant],
        isDisabled && styles.disabled,
        small && styles.small,
        style,
      ]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? colors.teal : colors.background}
        />
      ) : (
        <View style={styles.inner}>
          {icon && (
            <Text style={[styles.icon, { color: variant === 'outline' ? colors.teal : colors.background }]}>
              {icon}
            </Text>
          )}
          <Text
            style={[
              styles.text,
              variantTextStyles[variant],
              small && styles.smallText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 52,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  smallText: {
    fontSize: 13,
  },
  icon: {
    marginRight: 8,
    fontSize: 16,
  },
});

export default Button;
