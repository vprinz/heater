DOSSEG 
.MODEL SMALL 
.STACK 100h     
.DATA          

;================ Put data here ================
H       DW  12 DUP(?)   ; 12 значений влажности
T       DB  0           ; Значение температуры
US300   DW  0
C       DW  0           ; Счетчик для опроса датчиков
Mode    DW  0           ; Текущий режим (ТЭН не работает)

;===============================================

;=============== Put macros here ===============
checkSensor MACRO index, label
    IN AX, DX
    TEST AX, 8000h
    JZ label
    
    AND AX, 3FFFh    ; Выделение информационных разрядов
    MOV H[index], AX ; Сохранение значения ДВ[index]
ENDM

timeForCheck MACRO seconds, label
    ; Проверка необходимости считывать со N-ой группы датчиков
    ; ((ДВ7, ДВ9, ДВ11), (ДВ2, ДВ4, ДВ6) или (ДВ8, ДВ10, ДВ12))
    MOV AX, C 
    MOV BL, seconds
    DIV BL
    CMP AH, 0
    JNE label ; Переход на метку, где пропускается считывание N-ой группы датчиков
ENDM

checkForLaunch MACRO firstIndex, secondIndex, thirdIndex, label
    ; Проверка на включение обгоревателя
    ; Вычисление суммарной влажности группы датчиков
    MOV AX, H[firstIndex]
    ADD AX, H[secondIndex]
    ADD AX, H[thirdIndex]
    CMP AX, 2FAEh ; 80% влажности
    JAE turnOnHeater ; включаем обогреватель, как только влажность в N-ой группе датчиков >= 80%
ENDM
;===============================================

;================ Put code here ================
.CODE
MOV AX, @DATA 
MOV DS, AX 

Begin:
    MOV BX, 0   ; 0000b
    Call getHumidity
    MOV DX, 301h
H1:
    checkSensor 0, H1
    
    MOV BX, 1   ; 0001b
    CALL getHumidity  
    MOV DX, 301h
H3:
    checkSensor 2, H3
    
    MOV BX, 2   ; 0010b
    CALL getHumidity
    MOV DX, 301h   
H5:
    checkSensor 4, H5
    timeForCheck 2, skipSensorGroup2 ; 2=4с/2с, группа датчиков #2 - (ДВ7, ДВ9, ДВ11)
    
    MOV BX, 3   ; 0011b
    CALL getHumidity
    MOV DX, 301h
H7:
    checkSensor 6, H3
    
    MOV BX, 4   ; 0100b
    CALL getHumidity
    MOV DX, 301h
H9:
    checkSensor 8, H9
    
    MOV BX, 5   ; 0101b
    CALL getHumidity
    MOV DX, 301h
H11:
    checkSensor 10, H11

skipSensorGroup2:
    timeForCheck 3, skipSensorGroup3 ; 3=6с/2с, группа датчиков #3 - (ДВ2, ДВ4, ДВ6)
    
    MOV BX, 6   ; 0110b
    CALL getHumidity
    MOV DX, 301h
H2:
    checkSensor 12, H2
    
    MOV BX, 7   ; 0111b
    CALL getHumidity
    MOV DX, 301h
H4:
    checkSensor 14, H4
    
    MOV BX, 8   ; 1000b
    CALL getHumidity
    MOV DX, 301h
H6:
    checkSensor 16, H6

skipSensorGroup3:
    timeForCheck 4, skipSensorGroup4 ; 4=8с/2с, группа датчиков #4 - (ДВ8, ДВ10, ДВ12)
    
    MOV BX, 9   ; 1001b
    CALL getHumidity
    MOV DX, 301h
H8:
    checkSensor 18, H8
    
    MOV BX, 10   ; 1010b
    CALL getHumidity
    MOV DX, 301h
H10:
    checkSensor 20, H10
    
    MOV BX, 11   ; 1011b
    CALL getHumidity
    MOV DX, 301h
H12:
    checkSensor 22, H12

skipSensorGroup4:
    ; Вычисление суммарной влажности группы датчиков
    checkForLaunch 0, 2, 4, turnOnHeater
    checkForLaunch 6, 8, 10, turnOnHeater
    checkForLaunch 12, 14, 16, turnOnHeater
    checkForLaunch 18, 20, 22, turnOnHeater
    JMP toOut
    
turnOnHeater:
    MOV T, 1
    MOV AX, D3h ; Подали напряжение и включили (66 вольт)

toOut:
    MOV US300, AX
    
    MOV DX, 300h
    MOV AX, 80h
    OUT DX, AX
    
    MOV AX, US300
    MOV DX, AX
    OUT DX, AX  ; Управляющее воздействие на ЦАП
    
    ADD C, 1
    CMP C, 14
    JNE CNZ     ; Обнуление C на каждом 14-м шаге
    MOV C, 0

CNZ:
    CALL Delay2s
    
    MOV AH, 4Ch
    INT 21h

;================ Put proc here ================
getHumidity:
    MOV US300, BX
    MOV AX, US300
    MOV DX, 300h
    OUT DX, AX
    
    OR US300, 8000h
    MOV AX, US300
    MOV DX, 300h
    OUT DX, AX
    
    RET

Delay2s:
    MOV BX, 0DCh
L1: MOV CX, 25BFh
L2: NOP
    NOP
    NOP
    NOP
    NOP
    LOOP L2
    DEC BX
    JNZ L1
    RET

END
;===============================================

END
;===============================================
