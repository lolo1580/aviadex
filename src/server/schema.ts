export function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(
      "DATABASE_SCHEMA must start with a letter or underscore and contain only letters, numbers, and underscores.",
    );
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function tableName(schemaName: string, table: string) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(table)}`;
}
