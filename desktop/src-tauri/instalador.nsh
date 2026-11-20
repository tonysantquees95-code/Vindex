; Menu do botão direito (como no WinRAR): "Extrair com o Vindex…" e "Extrair aqui (Vindex)".
; Instalação por usuário: grava em HKCU, sem pedir administrador. No Windows 11 aparece em "Mostrar mais opções".
!macro VINDEX_MENU EXT
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrair" "" "Extrair com o Vindex…"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrair" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrair\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --extrair "%1"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrairAqui" "" "Extrair aqui (Vindex)"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrairAqui" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrairAqui\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --extrair-aqui "%1"'
!macroend

!macro VINDEX_MENU_FIM EXT
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrair"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\VindexExtrairAqui"
!macroend

; Documentos (PDF, Word, Excel, PowerPoint, CSV): o Vindex aparece em "Abrir com" e, quando a pessoa o escolhe como padrão,
; os arquivos ganham o ícone verde de documento (recursos\documento.ico) em vez do ícone do aplicativo.
!macro VINDEX_DOC EXT DESCRICAO
  WriteRegStr HKCU "Software\Classes\Vindex.Documento${EXT}" "" "${DESCRICAO}"
  WriteRegStr HKCU "Software\Classes\Vindex.Documento${EXT}\DefaultIcon" "" "$INSTDIR\recursos\documento.ico"
  WriteRegStr HKCU "Software\Classes\Vindex.Documento${EXT}\shell\open" "" "Abrir com o Vindex"
  WriteRegStr HKCU "Software\Classes\Vindex.Documento${EXT}\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\${EXT}\OpenWithProgids" "Vindex.Documento${EXT}" ""
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" "${EXT}" ""
!macroend

!macro VINDEX_DOC_FIM EXT
  DeleteRegValue HKCU "Software\Classes\${EXT}\OpenWithProgids" "Vindex.Documento${EXT}"
  DeleteRegKey HKCU "Software\Classes\Vindex.Documento${EXT}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "Vindex"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  !insertmacro VINDEX_DOC ".pdf" "Documento PDF"
  !insertmacro VINDEX_DOC ".docx" "Documento do Word"
  !insertmacro VINDEX_DOC ".xlsx" "Planilha do Excel"
  !insertmacro VINDEX_DOC ".pptx" "Apresentação do PowerPoint"
  !insertmacro VINDEX_DOC ".csv" "Tabela CSV"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  !insertmacro VINDEX_MENU ".zip"
  !insertmacro VINDEX_MENU ".tar"
  !insertmacro VINDEX_MENU ".gz"
  !insertmacro VINDEX_MENU ".tgz"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro VINDEX_DOC_FIM ".pdf"
  !insertmacro VINDEX_DOC_FIM ".docx"
  !insertmacro VINDEX_DOC_FIM ".xlsx"
  !insertmacro VINDEX_DOC_FIM ".pptx"
  !insertmacro VINDEX_DOC_FIM ".csv"
  DeleteRegKey HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  !insertmacro VINDEX_MENU_FIM ".zip"
  !insertmacro VINDEX_MENU_FIM ".tar"
  !insertmacro VINDEX_MENU_FIM ".gz"
  !insertmacro VINDEX_MENU_FIM ".tgz"
!macroend
