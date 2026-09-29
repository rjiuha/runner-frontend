# runner-frontend

Для запуска выполни следующие команды:
1. установи npm
2. запусти vs code
3. открой терминал
4. npm install
5. npm run web (или android)

Для тестирования с подключением реального устройства по USB необходимо выполнить в powershell команды и поднять туннели:
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8079 tcp:80
После этого проверить, что все три подняты adb reverse --list