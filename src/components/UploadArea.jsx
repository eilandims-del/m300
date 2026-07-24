// Área de upload: apenas a planilha principal Spotfire.
export function UploadArea({ onMainFile, loading, mainName, onClear }) {
  return (
    <div className="upload-area">
      <label className="upload-box primary">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv"
          onChange={(event) => event.target.files?.[0] && onMainFile(event.target.files[0])}
        />
        <span className="upload-icon">⬆️</span>
        <strong>{loading ? 'Processando...' : mainName ? 'Trocar planilha principal' : 'Selecionar planilha principal'}</strong>
        <span className="upload-hint">{mainName || 'XLSX, XLS, CSV ou TSV do Spotfire'}</span>
      </label>
      {mainName && onClear && (
        <button type="button" className="upload-clear" onClick={onClear} disabled={loading}>
          Limpar planilha
        </button>
      )}
      <p className="creator-credit" aria-label="Crédito do autor">Criado por: Lucas Landim</p>
    </div>
  );
}
