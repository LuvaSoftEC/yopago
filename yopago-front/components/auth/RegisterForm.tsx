import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedButton } from '../ui/Button';

const applyAlpha = (hexColor: string, alpha: number) => {
    const sanitized = hexColor.replace('#', '');
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const COUNTRY_OPTIONS = [
    { code: 'EC', label: 'Ecuador', dialCode: '+593' },
    { code: 'CO', label: 'Colombia', dialCode: '+57' },
    { code: 'PE', label: 'Perú', dialCode: '+51' },
];

interface RegisterFormProps {
    onRegisterSuccess?: () => void;
    onSwitchToLogin?: () => void;
    style?: StyleProp<ViewStyle>;
    variant?: 'card' | 'plain';
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
    onRegisterSuccess,
    onSwitchToLogin,
    style,
    variant = 'card',
}) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        phoneNumber: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    type FieldName = keyof typeof formData;
    type FieldErrors = Partial<Record<FieldName, string>>;

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({});

    const { t } = useTranslation();
    const { register, error, clearError } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const palette = Colors[colorScheme];
    const isPlain = variant === 'plain';

    const [selectedCountryIndex, setSelectedCountryIndex] = useState(0);
    const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

    const inputBackground = colorScheme === 'dark' ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.94)';
    const inputTextColor = colorScheme === 'dark' ? '#f8fafc' : palette.text;
    const placeholderColor = colorScheme === 'dark' ? 'rgba(248,250,252,0.86)' : 'rgba(15,23,42,0.52)';
    const labelColor = colorScheme === 'dark' ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.68)';
    const outlineColor = colorScheme === 'dark' ? 'rgba(148,163,184,0.32)' : 'rgba(15,23,42,0.22)';
    const helperTextColor = colorScheme === 'dark' ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.65)';
    const inlineErrorColor = palette.accent;
    const selectedCountry = COUNTRY_OPTIONS[selectedCountryIndex];

    const inputTheme = useMemo(
        () => ({
            colors: {
                primary: palette.tint,
                background: inputBackground,
                surface: inputBackground,
                text: inputTextColor,
                placeholder: placeholderColor,
                onSurface: inputTextColor,
                onSurfaceVariant: labelColor,
                outline: outlineColor,
            },
        }),
        [inputBackground, inputTextColor, labelColor, outlineColor, palette.tint, placeholderColor],
    );

    const errorBackground = applyAlpha(palette.accent, 0.12);
    const errorBorder = applyAlpha(palette.accent, 0.45);
    const nameRegex = /^[\p{L}\s'-]{2,}$/u;
    const usernameRegex = /^(?=.{4,20}$)[a-zA-Z0-9_]+$/;
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const phoneRegex = /^[0-9\s-]{7,20}$/;

    useEffect(() => {
        clearError();
        setFieldErrors({});
        setTouchedFields({});
    }, [clearError]);

    const validateField = (field: FieldName, value: string, data: typeof formData = formData): string | null => {
        const trimmed = value.trim();

        switch (field) {
            case 'firstName':
                if (!trimmed) return t('auth.firstNameRequired');
                if (!nameRegex.test(trimmed)) return t('auth.nameOnlyLetters');
                return null;
            case 'lastName':
                if (!trimmed) return t('auth.lastNameRequired');
                if (!nameRegex.test(trimmed)) return t('auth.nameOnlyLetters');
                return null;
            case 'username':
                return null;
            case 'email':
                if (!trimmed) return t('auth.emailRequired');
                if (!emailRegex.test(trimmed)) return t('auth.invalidEmail');
                return null;
            case 'phoneNumber':
                if (!trimmed) return t('auth.phoneNumberRequired');
                if (!phoneRegex.test(trimmed)) return t('auth.phoneNumberInvalid');
                return null;
            case 'password':
                if (!trimmed) return t('auth.passwordRequired');
                if (trimmed.length < 8) return t('auth.passwordRuleLength');
                if (!/[A-Z]/.test(trimmed)) return t('auth.passwordRuleUpper');
                if (!/[a-z]/.test(trimmed)) return t('auth.passwordRuleLower');
                if (!/\d/.test(trimmed)) return t('auth.passwordRuleNumber');
                if (!/[^A-Za-z0-9]/.test(trimmed)) return t('auth.passwordRuleSpecial');
                return null;
            case 'confirmPassword':
                if (!trimmed) return t('auth.confirmPasswordRequired');
                if (trimmed !== data.password) return t('auth.passwordsNotMatch');
                return null;
            default:
                return null;
        }
    };

    const runFieldValidation = (field: FieldName, value?: string, data?: typeof formData) => {
        const dataset = data ?? formData;
        const fieldValue = value ?? dataset[field];
        const error = validateField(field, fieldValue, dataset);
        setFieldErrors(prev => {
            const updated = { ...prev };
            if (error) {
                updated[field] = error;
            } else {
                delete updated[field];
            }
            return updated;
        });
        return error;
    };

    const validateForm = () => {
        const errors: FieldErrors = {};
        (Object.keys(formData) as FieldName[]).forEach(field => {
            const error = validateField(field, formData[field]);
            if (error) {
                errors[field] = error;
            }
        });
        return errors;
    };

    const updateField = (field: FieldName, value: string) => {
        const nextForm = { ...formData, [field]: value };
        setFormData(nextForm);

        if (touchedFields[field]) {
            runFieldValidation(field, value, nextForm);
        }

        if (field === 'password' && touchedFields.confirmPassword) {
            runFieldValidation('confirmPassword', nextForm.confirmPassword, nextForm);
        }
    };

    const handleFieldBlur = (field: FieldName) => {
        setTouchedFields(prev => ({ ...prev, [field]: true }));
        runFieldValidation(field);

        if (field === 'password' && touchedFields.confirmPassword) {
            runFieldValidation('confirmPassword');
        }
    };

    const passwordRequirements = useMemo(
        () => [
            { id: 'length', label: t('auth.passwordRuleLength'), met: formData.password.trim().length >= 8 },
            { id: 'upper', label: t('auth.passwordRuleUpper'), met: /[A-Z]/.test(formData.password) },
            { id: 'lower', label: t('auth.passwordRuleLower'), met: /[a-z]/.test(formData.password) },
            { id: 'number', label: t('auth.passwordRuleNumber'), met: /\d/.test(formData.password) },
            { id: 'special', label: t('auth.passwordRuleSpecial'), met: /[^A-Za-z0-9]/.test(formData.password) },
        ],
        [formData.password, t],
    );

    const handleRegister = async () => {
        const validation = validateForm();
        if (Object.keys(validation).length) {
            setFieldErrors(validation);
            setTouchedFields(
                (Object.keys(formData) as FieldName[]).reduce(
                    (acc, field) => ({ ...acc, [field]: true }),
                    {} as Partial<Record<FieldName, boolean>>,
                ),
            );
            return;
        }

        setFieldErrors({});
        setIsSubmitting(true);
        clearError();

        try {
            const fullPhone = `${selectedCountry.dialCode} ${formData.phoneNumber.trim()}`.trim();

            const emailLocalPart = formData.email.split('@')[0]?.trim() ?? '';
            const sanitizedUsername = emailLocalPart
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 20);

            const derivedUsername = sanitizedUsername || formData.username.trim();

            const registerPayload = { ...formData, username: derivedUsername, phoneNumber: fullPhone };

            const result = await register(registerPayload);

            if (result.success) {
                setFormData({
                    username: '',
                    email: '',
                    firstName: '',
                    lastName: '',
                    password: '',
                    confirmPassword: '',
                    phoneNumber: '',
                });
                setTouchedFields({});
                setFieldErrors({});

                onRegisterSuccess?.();
                onSwitchToLogin?.();

                setTimeout(() => {
                    Alert.alert(t('auth.registerSuccess'), t('auth.registerSuccessMessage', { username: result.data?.username }));
                }, 100);
            } else if (result.error) {
                Alert.alert(t('auth.registerError'), result.error);
            }
        } catch (err) {
            console.error('Error en registro:', err);
            Alert.alert(t('auth.registerError'), t('auth.registerErrorMessage'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const requiredFields: FieldName[] = ['firstName', 'lastName', 'email', 'phoneNumber', 'password', 'confirmPassword'];
    const hasEmptyFields = requiredFields.some(field => !formData[field].trim());
    const isButtonDisabled = isSubmitting || hasEmptyFields || Object.keys(fieldErrors).length > 0;

    const shouldShowError = (field: FieldName) => touchedFields[field] && fieldErrors[field];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: palette.background }, isPlain && styles.containerPlain, style]}
        >
            <ScrollView
                contentContainerStyle={[styles.scrollContainer, isPlain && styles.scrollContainerPlain]}
                keyboardShouldPersistTaps="handled"
            >
                <View
                    style={[
                        styles.formContainer,
                        { backgroundColor: palette.surface, borderColor: palette.divider },
                        isPlain && styles.formContainerPlain,
                    ]}
                >
                    {!isPlain && (
                        <Text style={[styles.title, { color: palette.text }]}>{t('auth.createAccount')}</Text>
                    )}
                    {error && (
                        <View
                            style={[
                                styles.errorContainer,
                                { backgroundColor: errorBackground, borderColor: errorBorder },
                                isPlain && styles.errorContainerPlain,
                            ]}
                        >
                            <Text style={[styles.errorText, { color: palette.accent }, isPlain && styles.errorTextPlain]}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <PaperTextInput
                            label={t('auth.firstName')}
                            value={formData.firstName}
                            onChangeText={value => updateField('firstName', value)}
                            mode="outlined"
                            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                            autoCapitalize="words"
                            editable={!isSubmitting}
                            textColor={inputTextColor}
                            placeholderTextColor={placeholderColor}
                            selectionColor={palette.tint}
                            theme={inputTheme}
                            onBlur={() => handleFieldBlur('firstName')}
                        />
                        <Text style={[styles.helperText, { color: helperTextColor }]}>{t('auth.nameHelper')}</Text>
                        {shouldShowError('firstName') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.firstName}</Text>
                        )}
                    </View>
                    <View style={styles.inputContainer}>
                        <PaperTextInput
                            label={t('auth.lastName')}
                            value={formData.lastName}
                            onChangeText={value => updateField('lastName', value)}
                            mode="outlined"
                            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                            autoCapitalize="words"
                            editable={!isSubmitting}
                            textColor={inputTextColor}
                            placeholderTextColor={placeholderColor}
                            selectionColor={palette.tint}
                            theme={inputTheme}
                            onBlur={() => handleFieldBlur('lastName')}
                        />
                        {shouldShowError('lastName') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.lastName}</Text>
                        )}
                    </View>
                    <View style={styles.inputContainer}>
                        <PaperTextInput
                            label={t('auth.email')}
                            value={formData.email}
                            onChangeText={value => updateField('email', value)}
                            mode="outlined"
                            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            keyboardType="email-address"
                            editable={!isSubmitting}
                            textColor={inputTextColor}
                            placeholderTextColor={placeholderColor}
                            selectionColor={palette.tint}
                            theme={inputTheme}
                            onBlur={() => handleFieldBlur('email')}
                        />
                        {shouldShowError('email') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.email}</Text>
                        )}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={styles.phoneRow}>
                            <TouchableOpacity
                                style={styles.countryCodeButton}
                                onPress={() => setIsCountryPickerVisible(true)}
                                activeOpacity={0.8}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.countryCodeText}>
                                    {selectedCountry.dialCode} {selectedCountry.code}
                                </Text>
                            </TouchableOpacity>

                            <PaperTextInput
                                label={t('auth.phoneNumber')}
                                value={formData.phoneNumber}
                                onChangeText={value => updateField('phoneNumber', value)}
                                mode="outlined"
                                style={[styles.input, styles.phoneInput, { backgroundColor: inputBackground, color: inputTextColor }]}
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="tel"
                                keyboardType="phone-pad"
                                editable={!isSubmitting}
                                textColor={inputTextColor}
                                placeholder={'98 123 4567'}
                                placeholderTextColor={placeholderColor}
                                selectionColor={palette.tint}
                                theme={inputTheme}
                                onBlur={() => handleFieldBlur('phoneNumber')}
                            />
                        </View>
                        <Text style={[styles.helperText, { color: helperTextColor }]}>{t('auth.phoneNumberHelper')}</Text>
                        {shouldShowError('phoneNumber') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.phoneNumber}</Text>
                        )}
                    </View>

                    <View style={styles.inputContainer}>
                        <PaperTextInput
                            label={t('auth.password')}
                            value={formData.password}
                            onChangeText={value => updateField('password', value)}
                            mode="outlined"
                            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="password"
                            editable={!isSubmitting}
                            textColor={inputTextColor}
                            placeholderTextColor={placeholderColor}
                            selectionColor={palette.tint}
                            theme={inputTheme}
                            onBlur={() => handleFieldBlur('password')}
                        />
                        <Text style={[styles.helperText, { color: helperTextColor }]}>{t('auth.passwordHelper')}</Text>
                        <View style={styles.passwordBadges}>
                            {passwordRequirements.map(req => (
                                <View
                                    key={req.id}
                                    style={[
                                        styles.passwordBadge,
                                        {
                                            backgroundColor: req.met
                                                ? applyAlpha(palette.tint, 0.16)
                                                : applyAlpha(palette.text, 0.08),
                                            borderColor: req.met ? palette.tint : 'transparent',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.passwordBadgeText,
                                            { color: req.met ? palette.tint : helperTextColor },
                                        ]}
                                    >
                                        {req.met ? '• ' : '○ '}
                                        {req.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {shouldShowError('password') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.password}</Text>
                        )}
                    </View>

                    <View style={styles.inputContainer}>
                        <PaperTextInput
                            label={t('auth.confirmPassword')}
                            value={formData.confirmPassword}
                            onChangeText={value => updateField('confirmPassword', value)}
                            mode="outlined"
                            style={[styles.input, { backgroundColor: inputBackground, color: inputTextColor }]}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="password"
                            editable={!isSubmitting}
                            textColor={inputTextColor}
                            placeholderTextColor={placeholderColor}
                            selectionColor={palette.tint}
                            theme={inputTheme}
                            onBlur={() => handleFieldBlur('confirmPassword')}
                        />
                        {shouldShowError('confirmPassword') && (
                            <Text style={[styles.errorTextInline, { color: inlineErrorColor }]}>{fieldErrors.confirmPassword}</Text>
                        )}
                    </View>

                    <ThemedButton
                        title={t('auth.createAccount')}
                        onPress={handleRegister}
                        loading={isSubmitting}
                        disabled={isButtonDisabled}
                        variant="primary"
                        fullWidth
                        style={[styles.registerButton, isPlain && styles.registerButtonPlain]}
                    />

                    {onSwitchToLogin && (
                        <View style={{ alignItems: 'center', marginTop: 18 }}>
                            <ThemedButton
                                title={t('auth.hasAccountLogin')}
                                onPress={onSwitchToLogin}
                                disabled={isSubmitting}
                                variant="ghost"
                                style={[styles.switchButton, isPlain && styles.switchButtonPlain, { alignSelf: 'center' }]}
                                textStyle={[
                                    styles.switchButtonText,
                                    { color: palette.tint, fontSize: 15, fontWeight: '600', textAlign: 'center' },
                                    isPlain && styles.switchButtonTextPlain,
                                ]}
                            />
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal
                transparent
                animationType="fade"
                visible={isCountryPickerVisible}
                onRequestClose={() => setIsCountryPickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.countryPickerOverlay}
                    activeOpacity={1}
                    onPress={() => setIsCountryPickerVisible(false)}
                >
                    <View style={styles.countryPickerContainer}>
                        {COUNTRY_OPTIONS.map((country, index) => (
                            <TouchableOpacity
                                key={country.code}
                                style={[
                                    styles.countryPickerItem,
                                    index === selectedCountryIndex && styles.countryPickerItemActive,
                                ]}
                                onPress={() => {
                                    setSelectedCountryIndex(index);
                                    setIsCountryPickerVisible(false);
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.countryPickerText}>
                                    {country.dialCode} · {country.label} ({country.code})
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    containerPlain: {
        backgroundColor: 'transparent',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    scrollContainerPlain: {
        padding: 0,
        justifyContent: 'flex-start',
    },
    formContainer: {
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        gap: 4,
    },
    formContainerPlain: {
        backgroundColor: 'transparent',
        borderRadius: 0,
        padding: 0,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
        borderWidth: 0,
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 32,
    },
    errorContainer: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorContainerPlain: {
        backgroundColor: 'rgba(254,242,242,0.9)',
        borderColor: 'rgba(248,113,113,0.65)',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    errorTextPlain: {
        textAlign: 'left',
    },
    row: {
        flexDirection: Platform.OS === 'web' ? 'row' : 'column',
        gap: 12,
    },
    rowPlain: {
        gap: Platform.OS === 'web' ? 12 : 12,
    },
    inputContainer: {
        marginBottom: 18,
        borderRadius: 8,
        overflow: 'hidden',
        paddingHorizontal: 8, // margen lateral para que el input no toque el borde del card
    },
    helperText: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    errorTextInline: {
        fontSize: 13,
        marginTop: 4,
        marginLeft: 4,
        fontWeight: '500',
    },
    halfWidth: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    labelPlain: {
        color: '#0f172a',
    },
    input: {
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16, // igual que login
        marginBottom: 6,
        textAlign: 'left',
        backgroundColor: 'rgba(30,41,59,0.55)', // fondo semitransparente acorde al card
        color: '#F2F6FA', // texto claro
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    countryCodeButton: {
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#64748b',
        backgroundColor: 'rgba(15,23,42,0.9)',
    },
    countryCodeText: {
        color: '#e2e8f0',
        fontWeight: '600',
        fontSize: 14,
    },
    phoneInput: {
        flex: 1,
    },
    inputPlain: {
        backgroundColor: 'rgba(30,41,59,0.55)',
        color: '#F2F6FA',
        textAlign: 'left',
        fontSize: 16, // igual que login
    },
    // Ajuste para el botón principal igual que login
    loginButton: {
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F2F6FA',
    },
    registerButton: {
        marginTop: 8,
        alignSelf: 'stretch',
    },
    registerButtonPlain: {
        alignSelf: 'center',
        width: '100%',
    },
    passwordBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    passwordBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
    },
    passwordBadgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    switchButton: {
        marginTop: 16,
        alignSelf: 'center',
    },
    switchButtonPlain: {
        alignSelf: 'flex-start',
    },
    switchButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    switchButtonTextPlain: {
        textAlign: 'left',
    },
    countryPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    countryPickerContainer: {
        width: '80%',
        backgroundColor: '#020617',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    countryPickerItem: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    countryPickerItemActive: {
        backgroundColor: 'rgba(56,189,248,0.18)',
    },
    countryPickerText: {
        color: '#e2e8f0',
        fontSize: 14,
    },
});

export default RegisterForm;