# Forge Android

This folder contains two modules:

- `sdk`: the reusable Forge Android runtime + UI renderers (library module).
- `sample`: a simple demo app that depends on `sdk`.

## Build the SDK

```
./gradlew -p android :sdk:assemble
```

## Run the sample app

```
./gradlew -p android :sample:assembleDebug
```

## Notes

- The `sample` module is intended for demo/development and is ignored from git by `android/.gitignore`.
- The Go mock backend lives under `android/mock-backend`.
