import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  LinearProgress,
  Chip,
  IconButton
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Inventory,
  People,
  AttachMoney,
  Warning,
  CheckCircle,
  MoreVert
} from '@mui/icons-material';

const StatCard = ({ title, value, change, icon, color = 'primary' }: any) => (
  <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
            {value}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {change > 0 ? (
              <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />
            ) : (
              <TrendingDown sx={{ color: 'error.main', fontSize: 16 }} />
            )}
            <Typography
              variant="body2"
              sx={{ color: change > 0 ? 'success.main' : 'error.main' }}
            >
              {Math.abs(change)}% vs mes anterior
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}.main`,
            color: 'white',
            borderRadius: 2,
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ProductAlert = ({ product, type, stock }: any) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {type === 'low' ? (
        <Warning sx={{ color: 'warning.main' }} />
      ) : (
        <CheckCircle sx={{ color: 'error.main' }} />
      )}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {product}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          Stock: {stock} unidades
        </Typography>
      </Box>
    </Box>
    <Chip
      label={type === 'low' ? 'Stock Bajo' : 'Agotado'}
      color={type === 'low' ? 'warning' : 'error'}
      size="small"
    />
  </Box>
);

export default function Dashboard() {
  const stats = [
    {
      title: 'Ventas Hoy',
      value: '$2,450,000',
      change: 12.5,
      icon: <AttachMoney />,
      color: 'success'
    },
    {
      title: 'Productos Vendidos',
      value: '156',
      change: 8.2,
      icon: <ShoppingCart />,
      color: 'primary'
    },
    {
      title: 'Productos en Stock',
      value: '1,234',
      change: -2.1,
      icon: <Inventory />,
      color: 'info'
    },
    {
      title: 'Usuarios Activos',
      value: '8',
      change: 0,
      icon: <People />,
      color: 'secondary'
    }
  ];

  const lowStockProducts = [
    { product: 'Coca Cola 600ml', stock: 5, type: 'low' },
    { product: 'Papas Margarita', stock: 2, type: 'low' },
    { product: 'Detergente Ariel', stock: 0, type: 'out' },
  ];

  const recentSales = [
    { id: 'V001', time: '14:30', amount: '$45,000', items: 3 },
    { id: 'V002', time: '14:25', amount: '$12,500', items: 1 },
    { id: 'V003', time: '14:20', amount: '$78,900', items: 5 },
    { id: 'V004', time: '14:15', amount: '$23,400', items: 2 },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} lg={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Ventas Recientes */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Ventas Recientes
                </Typography>
                <IconButton>
                  <MoreVert />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentSales.map((sale) => (
                  <Paper key={sale.id} sx={{ p: 2, backgroundColor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          Venta #{sale.id}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {sale.time} • {sale.items} productos
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {sale.amount}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Alertas de Inventario */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Alertas de Inventario
                </Typography>
                <Chip label="3" color="error" size="small" />
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {lowStockProducts.map((item, index) => (
                  <ProductAlert key={index} {...item} />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Gráfico de Ventas */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Ventas de la Semana
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, index) => {
                  const value = Math.random() * 100;
                  return (
                    <Box key={day}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{day}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          ${(value * 25000).toLocaleString()}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={value} 
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
