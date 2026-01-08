@echo off
echo Cleaning up build artifacts for local development...
echo.

if exist "build" (
    echo Removing build directory...
    rmdir /s /q "build"
)

if exist "build(1)" (
    echo Removing build(1) directory...
    rmdir /s /q "build(1)"
)

if exist "build(2)" (
    echo Removing build(2) directory...
    rmdir /s /q "build(2)"
)

if exist "build(3)" (
    echo Removing build(3) directory...
    rmdir /s /q "build(3)"
)

echo.
echo Build cleanup complete!
echo You can now run: npm start