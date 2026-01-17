# Contributing to YoPago

Thank you for your interest in contributing to YoPago! 🎉

## 🚀 Getting Started

1. **Fork** this repository
2. **Clone** your fork locally
3. **Create** a branch for your feature: `git checkout -b feature/my-new-feature`
4. **Develop** following the style guides
5. **Commit** your changes: `git commit -m 'feat: add new functionality'`
6. **Push** to your fork: `git push origin feature/my-new-feature`
7. **Open** a Pull Request

## 📋 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Format changes (don't affect code)
- `refactor:` Code refactoring
- `test:` Add or modify tests
- `chore:` Maintenance tasks

## 🏗️ Project Structure

```
├── yopago/          # Backend Spring Boot (Java 21)
├── yopago-front/    # Frontend Expo + React Native
├── keycloak/        # Identity Provider Configuration
├── vision-ia/       # OCR Service with OpenAI (Python)
├── bdd/             # Database Scripts
└── k8s/             # Kubernetes Manifests
```

## 🧪 Running Tests

### Backend
```bash
cd yopago
./mvnw test
```

### Frontend
```bash
cd yopago-front
npm test
```

## 📝 Style Guides

- **Java**: Follow standard Spring Boot conventions
- **TypeScript/React**: ESLint configured in the project
- **Python**: PEP 8

## ❓ Questions?

Open an [Issue](../../issues) if you have questions or suggestions.

---

Thank you for contributing! 💙
