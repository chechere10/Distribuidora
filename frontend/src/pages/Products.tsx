import { useEffect, useState } from 'react';
import { api } from '../api';
import { Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';

type Product = { id: string; name: string; barcode?: string | null; defaultPrice: string };

export default function Products() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Product[]>([]);

  const fetchProducts = async (query?: string) => {
    const url = `/products${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    const res = await api.get<Product[]>(url);
    setRows(res);
  };

  useEffect(() => { fetchProducts(); }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Productos</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Buscar" value={q} onChange={e => setQ(e.target.value)} sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={() => fetchProducts(q)}>Buscar</Button>
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Código</TableCell>
              <TableCell align="right">Precio</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.barcode}</TableCell>
                <TableCell align="right">{Number(r.defaultPrice).toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}


