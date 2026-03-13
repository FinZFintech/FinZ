import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../store/ThemeContext';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  maxLength,
  editable = true,
  secureTextEntry = false,
  autoCapitalize = 'none',
  multiline = false,
  rightIcon,
  prefix,
  style,
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          { borderColor: colors.border, backgroundColor: colors.inputBg },
          isFocused && { borderColor: colors.teal, backgroundColor: colors.surface },
          error && { borderColor: colors.error, backgroundColor: 'rgba(255,107,107,0.08)' },
          !editable && { backgroundColor: colors.cardBg, opacity: 0.6 },
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.disabled}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, { color: colors.textPrimary }, multiline && styles.multiline]}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
  },
  prefix: {
    paddingLeft: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rightIcon: {
    paddingRight: 12,
  },
  error: {
    fontSize: 12,
    marginTop: 5,
    marginLeft: 4,
  },
});

export default Input;
