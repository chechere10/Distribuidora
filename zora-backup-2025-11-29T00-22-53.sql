--
-- PostgreSQL database dump
--

\restrict LMaJTAm6Z5yvrMfO9clNwYGqstYp2Sdbbj9Qidi4SO3EK1bZkZ6bfz55UfJxUdk

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: zora
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO zora;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: zora
--

COMMENT ON SCHEMA public IS '';


--
-- Name: CashMovementType; Type: TYPE; Schema: public; Owner: zora
--

CREATE TYPE public."CashMovementType" AS ENUM (
    'IN',
    'OUT'
);


ALTER TYPE public."CashMovementType" OWNER TO zora;

--
-- Name: LoanStatus; Type: TYPE; Schema: public; Owner: zora
--

CREATE TYPE public."LoanStatus" AS ENUM (
    'ACTIVE',
    'PAID',
    'DEFAULTED',
    'CANCELLED'
);


ALTER TYPE public."LoanStatus" OWNER TO zora;

--
-- Name: MovementType; Type: TYPE; Schema: public; Owner: zora
--

CREATE TYPE public."MovementType" AS ENUM (
    'IN',
    'OUT',
    'ADJUST'
);


ALTER TYPE public."MovementType" OWNER TO zora;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: zora
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED'
);


ALTER TYPE public."OrderStatus" OWNER TO zora;

--
-- Name: PurchaseStatus; Type: TYPE; Schema: public; Owner: zora
--

CREATE TYPE public."PurchaseStatus" AS ENUM (
    'PENDING',
    'RECEIVED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseStatus" OWNER TO zora;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CashMovement; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."CashMovement" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    type public."CashMovementType" NOT NULL,
    amount numeric(12,2) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CashMovement" OWNER TO zora;

--
-- Name: CashSession; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."CashSession" (
    id text NOT NULL,
    "warehouseId" text NOT NULL,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "openingAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "closingAmount" numeric(12,2),
    "closedByUserId" text,
    "totalSales" numeric(12,2),
    "totalCash" numeric(12,2),
    "totalTransfer" numeric(12,2),
    "totalFiados" numeric(12,2),
    "salesCount" integer,
    "expectedCash" numeric(12,2),
    "cashDifference" numeric(12,2),
    notes text,
    "openedByUserId" text
);


ALTER TABLE public."CashSession" OWNER TO zora;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3B82F6'::text,
    icon text DEFAULT 'category'::text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Category" OWNER TO zora;

--
-- Name: Employee; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Employee" (
    id text NOT NULL,
    name text NOT NULL,
    document text,
    phone text,
    "position" text,
    salary numeric(12,2),
    business text DEFAULT 'distribuidora'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Employee" OWNER TO zora;

--
-- Name: Expense; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Expense" (
    id text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    category text NOT NULL,
    "supplierName" text,
    amount numeric(12,2) NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    business text DEFAULT 'distribuidora'::text NOT NULL,
    description text,
    "invoiceNumber" text,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "paymentMethod" text,
    "receiptUrl" text,
    subcategory text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text
);


ALTER TABLE public."Expense" OWNER TO zora;

--
-- Name: ExpenseCategory; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."ExpenseCategory" (
    id text NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'receipt'::text,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    business text DEFAULT 'distribuidora'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ExpenseCategory" OWNER TO zora;

--
-- Name: InventoryMovement; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."InventoryMovement" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "warehouseId" text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    type public."MovementType" NOT NULL,
    "referenceId" text,
    "unitCost" numeric(12,2),
    "presentationId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text
);


ALTER TABLE public."InventoryMovement" OWNER TO zora;

--
-- Name: Loan; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Loan" (
    id text NOT NULL,
    "loanNumber" integer NOT NULL,
    type text NOT NULL,
    "employeeId" text,
    "borrowerName" text NOT NULL,
    "borrowerPhone" text,
    "borrowerDocument" text,
    business text DEFAULT 'distribuidora'::text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "interestRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "paidAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) NOT NULL,
    "disbursementDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone,
    status public."LoanStatus" DEFAULT 'ACTIVE'::public."LoanStatus" NOT NULL,
    notes text,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Loan" OWNER TO zora;

--
-- Name: LoanPayment; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."LoanPayment" (
    id text NOT NULL,
    "loanId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "paymentMethod" text,
    notes text,
    "receiptUrl" text,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LoanPayment" OWNER TO zora;

--
-- Name: Loan_loanNumber_seq; Type: SEQUENCE; Schema: public; Owner: zora
--

CREATE SEQUENCE public."Loan_loanNumber_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Loan_loanNumber_seq" OWNER TO zora;

--
-- Name: Loan_loanNumber_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: zora
--

ALTER SEQUENCE public."Loan_loanNumber_seq" OWNED BY public."Loan"."loanNumber";


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    "productId" text,
    "warehouseId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone
);


ALTER TABLE public."Notification" OWNER TO zora;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "warehouseId" text NOT NULL,
    "customerName" text,
    "customerPhone" text,
    total numeric(12,2) NOT NULL,
    "priceType" text DEFAULT 'publico'::text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "paymentMethod" text,
    "saleId" text,
    "dueDate" timestamp(3) without time zone,
    "paidByUserId" text,
    "userId" text
);


ALTER TABLE public."Order" OWNER TO zora;

--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    "presentationId" text,
    "presentationName" text,
    quantity numeric(12,3) NOT NULL,
    "baseQuantity" numeric(12,3) NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);


ALTER TABLE public."OrderItem" OWNER TO zora;

--
-- Name: PriceList; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."PriceList" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PriceList" OWNER TO zora;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    barcode text,
    "categoryId" text,
    "defaultPrice" numeric(12,2) NOT NULL,
    cost numeric(12,2) DEFAULT 0 NOT NULL,
    "imageUrl" text,
    "baseUnit" text DEFAULT 'unidad'::text NOT NULL,
    "baseStock" numeric(12,3) DEFAULT 0 NOT NULL,
    "minStock" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "barcodeImageUrl" text,
    "barcodeImageRotation" integer DEFAULT 0 NOT NULL,
    "barcodeImageScale" double precision DEFAULT 1 NOT NULL,
    "priceEmpleados" numeric(12,2),
    "priceSanAlas" numeric(12,2)
);


ALTER TABLE public."Product" OWNER TO zora;

--
-- Name: ProductPresentation; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."ProductPresentation" (
    id text NOT NULL,
    "productId" text NOT NULL,
    name text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    price numeric(12,2) NOT NULL,
    "priceSanAlas" numeric(12,2),
    barcode text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "priceEmpleados" numeric(12,2)
);


ALTER TABLE public."ProductPresentation" OWNER TO zora;

--
-- Name: ProductPrice; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."ProductPrice" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "priceListId" text NOT NULL,
    price numeric(12,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProductPrice" OWNER TO zora;

--
-- Name: Purchase; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Purchase" (
    id text NOT NULL,
    "purchaseNumber" integer NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "supplierId" text,
    "supplierName" text,
    "warehouseId" text NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax numeric(12,2),
    discount numeric(12,2),
    total numeric(12,2) NOT NULL,
    status public."PurchaseStatus" DEFAULT 'RECEIVED'::public."PurchaseStatus" NOT NULL,
    "invoiceNumber" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text
);


ALTER TABLE public."Purchase" OWNER TO zora;

--
-- Name: PurchaseItem; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."PurchaseItem" (
    id text NOT NULL,
    "purchaseId" text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    "presentationId" text,
    "presentationName" text,
    quantity numeric(12,3) NOT NULL,
    "baseQuantity" numeric(12,3) NOT NULL,
    "unitCost" numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);


ALTER TABLE public."PurchaseItem" OWNER TO zora;

--
-- Name: Purchase_purchaseNumber_seq; Type: SEQUENCE; Schema: public; Owner: zora
--

CREATE SEQUENCE public."Purchase_purchaseNumber_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Purchase_purchaseNumber_seq" OWNER TO zora;

--
-- Name: Purchase_purchaseNumber_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: zora
--

ALTER SEQUENCE public."Purchase_purchaseNumber_seq" OWNED BY public."Purchase"."purchaseNumber";


--
-- Name: Sale; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Sale" (
    id text NOT NULL,
    "saleNumber" integer NOT NULL,
    "warehouseId" text NOT NULL,
    total numeric(12,2) NOT NULL,
    subtotal numeric(12,2),
    domicilio numeric(12,2),
    "paymentMethod" text,
    "priceType" text DEFAULT 'publico'::text NOT NULL,
    "cashReceived" numeric(12,2),
    change numeric(12,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text
);


ALTER TABLE public."Sale" OWNER TO zora;

--
-- Name: SaleItem; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."SaleItem" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "productId" text NOT NULL,
    "presentationId" text,
    quantity numeric(12,3) NOT NULL,
    "baseQuantity" numeric(12,3) NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);


ALTER TABLE public."SaleItem" OWNER TO zora;

--
-- Name: Sale_saleNumber_seq; Type: SEQUENCE; Schema: public; Owner: zora
--

CREATE SEQUENCE public."Sale_saleNumber_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Sale_saleNumber_seq" OWNER TO zora;

--
-- Name: Sale_saleNumber_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: zora
--

ALTER SEQUENCE public."Sale_saleNumber_seq" OWNED BY public."Sale"."saleNumber";


--
-- Name: StockLevel; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."StockLevel" (
    "productId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "onHand" numeric(12,3) DEFAULT 0 NOT NULL,
    "minStock" numeric(12,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public."StockLevel" OWNER TO zora;

--
-- Name: Supplier; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Supplier" (
    id text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    phone text,
    email text,
    address text,
    nit text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Supplier" OWNER TO zora;

--
-- Name: SupplierPendingIssue; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."SupplierPendingIssue" (
    id text NOT NULL,
    "supplierId" text NOT NULL,
    "purchaseId" text,
    type text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2),
    "isResolved" boolean DEFAULT false NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resolvedByUserId" text,
    "userId" text
);


ALTER TABLE public."SupplierPendingIssue" OWNER TO zora;

--
-- Name: User; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "passwordHash" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    username text NOT NULL,
    name text,
    role text DEFAULT 'operario'::text NOT NULL
);


ALTER TABLE public."User" OWNER TO zora;

--
-- Name: Warehouse; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public."Warehouse" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Warehouse" OWNER TO zora;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: zora
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO zora;

--
-- Name: Loan loanNumber; Type: DEFAULT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Loan" ALTER COLUMN "loanNumber" SET DEFAULT nextval('public."Loan_loanNumber_seq"'::regclass);


--
-- Name: Purchase purchaseNumber; Type: DEFAULT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Purchase" ALTER COLUMN "purchaseNumber" SET DEFAULT nextval('public."Purchase_purchaseNumber_seq"'::regclass);


--
-- Name: Sale saleNumber; Type: DEFAULT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Sale" ALTER COLUMN "saleNumber" SET DEFAULT nextval('public."Sale_saleNumber_seq"'::regclass);


--
-- Data for Name: CashMovement; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."CashMovement" (id, "sessionId", type, amount, "referenceType", "referenceId", notes, "createdAt") FROM stdin;
cmiihliq40013j39fuibneejt	cmihspnh50001kpw5t6uxo0co	OUT	2000.00	EXPENSE	cmiihlipl0011j39fnskatdsc	Gasto: mantenimiento	2025-11-28 06:34:00.844
cmiihmfn00017j39fi9uke3eo	cmihspnh50001kpw5t6uxo0co	OUT	2000.00	LOAN	cmiihmfmk0015j39fd9t5bprm	Préstamo a: luisa	2025-11-28 06:34:43.5
cmij1awa80008sfthxhebf1uv	cmihspnh50001kpw5t6uxo0co	IN	5000.00	SALE	cmij1aw9a0002sfthw54g4zvr	\N	2025-11-28 15:45:37.521
cmijirc4t0008mjtxfzlzwpb0	cmihspnh50001kpw5t6uxo0co	IN	14000.00	SALE	cmijirc3o0002mjtxj42yi5u9	\N	2025-11-28 23:54:18.029
cmijjb30t000gayuiwl3j2oee	cmihspnh50001kpw5t6uxo0co	IN	12000.00	SALE	cmijjb2zy0002ayuiz9yd0em7	\N	2025-11-29 00:09:39.342
cmijjbwv7000payui8x1r3lov	cmihspnh50001kpw5t6uxo0co	IN	2500.00	SALE	cmijjbwuu000jayui9e9qo3gm	\N	2025-11-29 00:10:18.019
cmijjcw1t0012ayuiqfj9qpa5	cmihspnh50001kpw5t6uxo0co	IN	4000.00	SALE	cmijjcw1c000sayui9sayq9iq	\N	2025-11-29 00:11:03.617
\.


--
-- Data for Name: CashSession; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."CashSession" (id, "warehouseId", "openedAt", "closedAt", "openingAmount", "closingAmount", "closedByUserId", "totalSales", "totalCash", "totalTransfer", "totalFiados", "salesCount", "expectedCash", "cashDifference", notes, "openedByUserId") FROM stdin;
cmihspnh50001kpw5t6uxo0co	cmihpra7i0001hlhn4unyn7s0	2025-11-27 18:57:23.225	\N	0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Category" (id, name, description, color, icon, "isActive", "createdAt", "updatedAt") FROM stdin;
cmihpra830004hlhnje45gonv	Bebidas	Refrescos, jugos, agua	#3B82F6	category	t	2025-11-27 17:34:40.516	2025-11-27 17:34:40.516
cmihpra8n0007hlhn1w7fbzxo	Aseo	Productos de limpieza	#8B5CF6	category	t	2025-11-27 17:34:40.535	2025-11-27 17:34:40.535
cmiigcdon0004a6e2ih0ga1e3	LU	\N	#8B5CF6	category	t	2025-11-28 05:58:54.791	2025-11-28 05:58:54.791
cmij2rcqs0002lb68i4lopgn7	DESECHABLES VARIOS	\N	#10B981	category	t	2025-11-28 16:26:24.964	2025-11-28 16:26:24.964
cmij7xwul001ilb68825py611	BOLSAS	\N	#3B82F6	category	t	2025-11-28 18:51:29.038	2025-11-28 18:51:29.038
cmijbkui8000ahw3yyhxhcy2n	VASOS Y COPAS	\N	#F59E0B	category	t	2025-11-28 20:33:17.936	2025-11-28 20:33:17.936
cmijbtb8e0011hw3yhe7zlyio	PLATOS	\N	#EF4444	category	t	2025-11-28 20:39:52.862	2025-11-28 20:39:52.862
cmijc58ww001mhw3yjyn7syuq	PORTACOMIDAS	\N	#8B5CF6	category	t	2025-11-28 20:49:09.728	2025-11-28 20:49:09.728
cmijepaiw002bhw3y6qt8xvaz	BANDEJAS	\N	#EC4899	category	t	2025-11-28 22:00:44.168	2025-11-28 22:01:47.909
cmijezcac002uhw3ypduw4tnf	CUBIERTOS	\N	#06B6D4	category	t	2025-11-28 22:08:33.013	2025-11-28 22:08:33.013
cmijf7ou90039hw3yh518pga3	CONTENEDORES,  POSTRES Y LASAÑAS 	\N	#84CC16	category	t	2025-11-28 22:15:02.53	2025-11-28 22:15:02.53
cmihpra8g0006hlhn6v898icm	Lácteos	Leche, queso, yogurt	#10B981	category	f	2025-11-27 17:34:40.529	2025-11-28 22:19:57.32
cmihpra8z0009hlhn2lv9cqqt	Licores	Bebidas alcohólicas	#EC4899	category	f	2025-11-27 17:34:40.547	2025-11-28 22:20:00.907
cmihpra8a0005hlhn3y78qwbs	Snacks	Papas, galletas, dulces	#F59E0B	category	f	2025-11-27 17:34:40.523	2025-11-28 22:21:13.322
cmihpra8t0008hlhnt0ztdo1f	Comestibles	Alimentos en general	#EF4444	category	f	2025-11-27 17:34:40.541	2025-11-28 22:21:23.62
\.


--
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Employee" (id, name, document, phone, "position", salary, business, "isActive", "startDate", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Expense; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Expense" (id, date, category, "supplierName", amount, notes, "createdAt", business, description, "invoiceNumber", "isRecurring", "paymentMethod", "receiptUrl", subcategory, "updatedAt", "userId") FROM stdin;
cmiihlipl0011j39fnskatdsc	2025-11-28 00:00:00	mantenimiento	Distribuidora	2000.00		2025-11-28 06:34:00.825	distribuidora	compra de escoba	1	f	efectivo	\N		2025-11-28 06:34:00.825	cmihpra760000hlhnjc842qcd
\.


--
-- Data for Name: ExpenseCategory; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."ExpenseCategory" (id, name, icon, color, business, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InventoryMovement; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."InventoryMovement" (id, "productId", "warehouseId", quantity, type, "referenceId", "unitCost", "presentationId", notes, "createdAt", "userId") FROM stdin;
cmihqyf8r000cb6s851and1wf	cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmihqyf8j0008b6s8kay42q4a	1.00	\N	Compra #1	2025-11-27 18:08:13.228	\N
cmihr2je9000ob6s84avdny52	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmihr2je2000kb6s8ag5uumw8	100.00	\N	Compra #2 - juan	2025-11-27 18:11:25.233	\N
cmihtbsoa0008kpw5iw7d4c15	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmihtbso20004kpw5dwi7pjag	100.00	\N	Compra #3 - juan	2025-11-27 19:14:36.394	\N
cmihto3r7000fkpw5hnf7bg7w	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	10.000	IN	cmihto3qu000bkpw5fy1k3tar	100.00	\N	Compra #4 - juan	2025-11-27 19:24:10.627	\N
cmihtziky0006zug0vprltkxs	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmihtzikn0002zug08pq7eftd	100.00	\N	Compra #5 - juan	2025-11-27 19:33:03.059	\N
cmihu2ufc000bzug09l4osw42	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	DELETE-cmihtzikn0002zug08pq7eftd	\N	\N	Eliminación de compra #5	2025-11-27 19:35:38.376	\N
cmihu2yle000ezug0rfaqysye	cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	DELETE-cmihqyf8j0008b6s8kay42q4a	\N	\N	Eliminación de compra #1	2025-11-27 19:35:43.778	\N
cmihw2ipb000i10oz9acxrsfw	cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	-3.000	OUT	cmihw2ioy000e10ozutxmfpzj	\N	\N	\N	2025-11-27 20:31:22.416	\N
cmihw5mdb000r10oz699y2c3m	cmihq1k4c0001b6s8zi03fazj	cmihpra7i0001hlhn4unyn7s0	-2.000	OUT	cmihw5md5000n10oz5wdx5v8z	\N	\N	\N	2025-11-27 20:33:47.135	\N
cmiihg2s2000oj39f4i8rxfgz	cmiih6t0l0001j39fgoduz4ih	cmihpra7i0001hlhn4unyn7s0	10.000	IN	cmiihg2rq000kj39f895kjl3n	3000.00	\N	Compra #6 - ARROZ	2025-11-28 06:29:46.898	cmihpra760000hlhnjc842qcd
cmiihg5vt000rj39fctk9yzhr	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	-10.000	OUT	DELETE-cmihto3qu000bkpw5fy1k3tar	\N	\N	Eliminación de compra #4	2025-11-28 06:29:50.922	\N
cmiihg7fy000uj39fqutg6fnc	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	DELETE-cmihtbso20004kpw5dwi7pjag	\N	\N	Eliminación de compra #3	2025-11-28 06:29:52.943	\N
cmiihg8l6000xj39fjnq901aa	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	DELETE-cmihr2je2000kb6s8ag5uumw8	\N	\N	Eliminación de compra #2	2025-11-28 06:29:54.426	\N
cmiiy9y7k00061481usav828t	cmiih6t0l0001j39fgoduz4ih	cmihpra7i0001hlhn4unyn7s0	30.000	IN	DELETE-cmiih97y1000aj39f7lcjemnq	\N	\N	\N	2025-11-28 14:20:54.513	\N
cmiiy9zay0008148178j7etn0	cmihq1k4c0001b6s8zi03fazj	cmihpra7i0001hlhn4unyn7s0	2.000	IN	DELETE-cmihw5md5000n10oz5wdx5v8z	\N	\N	\N	2025-11-28 14:20:55.93	\N
cmiiya0mr000a14811qpf3aod	cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	3.000	IN	DELETE-cmihw2ioy000e10ozutxmfpzj	\N	\N	\N	2025-11-28 14:20:57.652	\N
cmiiya1xz000c1481d9vqox9h	cmihq1k4c0001b6s8zi03fazj	cmihpra7i0001hlhn4unyn7s0	3.000	IN	DELETE-cmihvsyi4000710ozygixqqcp	\N	\N	\N	2025-11-28 14:20:59.351	\N
cmiiya1yt000e14816xdls16q	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	9.000	IN	DELETE-cmihvsyi4000710ozygixqqcp	\N	\N	\N	2025-11-28 14:20:59.381	\N
cmiiya1z9000g1481x7yycnmj	cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	3.000	IN	DELETE-cmihvsyi4000710ozygixqqcp	\N	\N	\N	2025-11-28 14:20:59.398	\N
cmij1aw9y0006sfthjlaaorgv	cmiixm3bz000114810vb3e79e	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmij1aw9a0002sfthw54g4zvr	\N	\N	\N	2025-11-28 15:45:37.51	cmihpra760000hlhnjc842qcd
cmij1rk940001lb68gz9m5kw6	cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	2.000	IN	DELETE-cmihvohie0010zug0dye8ixaw	\N	\N	\N	2025-11-28 15:58:35.079	\N
cmijfjf9s003ihw3ywmywe0hr	cmijf8dq1003bhw3yayllqcpx	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmijfjf8e003ehw3y4k4i12fh	14000.00	\N	Compra #7	2025-11-28 22:24:09.999	cmihpra760000hlhnjc842qcd
cmijfjvxc00063l34j836ckma	cmijf8dq1003bhw3yayllqcpx	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmijfjvx200023l344jcczgig	14000.00	\N	Compra #8 - juan	2025-11-28 22:24:31.585	cmihpra760000hlhnjc842qcd
cmijfkhe5000d3l34d34nve9p	cmijf6fdz0036hw3y7pbob83e	cmihpra7i0001hlhn4unyn7s0	1.000	IN	cmijfkhdw00093l34tqxprh3a	6000.00	\N	Compra #9 - juan	2025-11-28 22:24:59.406	cmihpra760000hlhnjc842qcd
cmijirc4h0006mjtxnneagshw	cmijf8dq1003bhw3yayllqcpx	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijirc3o0002mjtxj42yi5u9	\N	\N	\N	2025-11-28 23:54:18.017	cmihpra760000hlhnjc842qcd
cmijjb3080006ayui6lqccm9a	cmij4i3do000nlb68fup8z4se	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjb2zy0002ayuiz9yd0em7	\N	\N	\N	2025-11-29 00:09:39.32	cmihpra760000hlhnjc842qcd
cmijjb30e000aayuifkpcp7bb	cmij4oh09000rlb68qzqtu5xf	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjb2zy0002ayuiz9yd0em7	\N	\N	\N	2025-11-29 00:09:39.327	cmihpra760000hlhnjc842qcd
cmijjb30k000eayuis4ubh86o	cmij4nm62000plb68ujksvki9	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjb2zy0002ayuiz9yd0em7	\N	\N	\N	2025-11-29 00:09:39.333	cmihpra760000hlhnjc842qcd
cmijjbwv0000nayuienilk7os	cmij7dqjn000xlb68c05zr45c	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjbwuu000jayui9e9qo3gm	\N	\N	\N	2025-11-29 00:10:18.012	cmihpra760000hlhnjc842qcd
cmijjcw1h000wayuipjwmvmjp	cmij7cqst000vlb68zqtayysc	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjcw1c000sayui9sayq9iq	\N	\N	\N	2025-11-29 00:11:03.606	cmihpra760000hlhnjc842qcd
cmijjcw1m0010ayuinyaozdcs	cmij7dqjn000xlb68c05zr45c	cmihpra7i0001hlhn4unyn7s0	-1.000	OUT	cmijjcw1c000sayui9sayq9iq	\N	\N	\N	2025-11-29 00:11:03.61	cmihpra760000hlhnjc842qcd
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Loan" (id, "loanNumber", type, "employeeId", "borrowerName", "borrowerPhone", "borrowerDocument", business, amount, "interestRate", "totalAmount", "paidAmount", balance, "disbursementDate", "dueDate", status, notes, "userId", "createdAt", "updatedAt") FROM stdin;
cmiihmfmk0015j39fd9t5bprm	1	employee	\N	luisa	123123123	12313123	sanAlas	2000.00	0.00	2000.00	0.00	2000.00	2025-11-28 00:00:00	\N	ACTIVE		cmihpra760000hlhnjc842qcd	2025-11-28 06:34:43.484	2025-11-28 06:34:43.484
\.


--
-- Data for Name: LoanPayment; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."LoanPayment" (id, "loanId", amount, "paymentMethod", notes, "receiptUrl", "userId", "createdAt") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Notification" (id, type, message, "productId", "warehouseId", "createdAt", "resolvedAt") FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Order" (id, "warehouseId", "customerName", "customerPhone", total, "priceType", status, notes, "createdAt", "paidAt", "paymentMethod", "saleId", "dueDate", "paidByUserId", "userId") FROM stdin;
cmihw7iao000v10ozhh10zu4q	cmihpra7i0001hlhn4unyn7s0	ggg	\N	66.00	sanAlas	CANCELLED	mhg	2025-11-27 20:35:15.166	\N	\N	\N	\N	\N	\N
cmiihanup000ej39fh0uen7ji	cmihpra7i0001hlhn4unyn7s0	hhh	87t876	120000.00	publico	CANCELLED	\N	2025-11-28 06:25:34.271	\N	\N	\N	2025-11-28 00:00:00	\N	cmihpra760000hlhnjc842qcd
cmiih8gnl0006j39flol7xfuc	cmihpra7i0001hlhn4unyn7s0	luisa	1231231234	55000.00	sanAlas	PAID	paga mañana	2025-11-28 06:23:51.633	2025-11-28 06:24:27.011	efectivo	\N	2025-11-30 00:00:00	cmihpra760000hlhnjc842qcd	cmihpra760000hlhnjc842qcd
cmihvslf2000110oz8jv9eoz9	cmihpra7i0001hlhn4unyn7s0	sdfsdf	12312312	18135.00	sanAlas	PAID	\N	2025-11-27 20:23:39.373	2025-11-27 20:23:56.341	efectivo	\N	\N	\N	\N
cmihuxg7m000gzug0giwz2c1j	cmihpra7i0001hlhn4unyn7s0	pryeba	1231231234	6000.00	publico	PAID	paga m,añana	2025-11-27 19:59:26.29	2025-11-27 20:20:27.699	efectivo	\N	\N	\N	\N
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."OrderItem" (id, "orderId", "productId", "productName", "presentationId", "presentationName", quantity, "baseQuantity", "unitPrice", subtotal) FROM stdin;
cmihuxg7m000izug0j8mdlfsk	cmihuxg7m000gzug0giwz2c1j	cmihr2igt000fb6s8e1988lxb	pruf	\N	\N	2.000	2.000	3000.00	6000.00
cmihvslf2000310ozfyljjsvz	cmihvslf2000110oz8jv9eoz9	cmihq1k4c0001b6s8zi03fazj	dafewf	\N	\N	3.000	3.000	22.00	66.00
cmihvslf2000410ozozqq9t0v	cmihvslf2000110oz8jv9eoz9	cmihr2igt000fb6s8e1988lxb	pruf	\N	\N	9.000	9.000	2000.00	18000.00
cmihvslf2000510ozuun9kben	cmihvslf2000110oz8jv9eoz9	cmihqy9um0003b6s8ukd2k58t	sdfsdf	\N	\N	3.000	3.000	23.00	69.00
cmihw7iao000x10oz0cr6l644	cmihw7iao000v10ozhh10zu4q	cmihq1k4c0001b6s8zi03fazj	dafewf	\N	\N	3.000	3.000	22.00	66.00
cmiih8gnm0008j39fw3hiqpzn	cmiih8gnl0006j39flol7xfuc	cmiih6t0l0001j39fgoduz4ih	Chokis	cmiih6t0m0004j39fae0m53vy	Paca	1.000	30.000	55000.00	55000.00
cmiihanuq000gj39fo4guj0gc	cmiihanup000ej39fh0uen7ji	cmiih6t0l0001j39fgoduz4ih	Chokis	cmiih6t0m0004j39fae0m53vy	Paca	2.000	60.000	60000.00	120000.00
\.


--
-- Data for Name: PriceList; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."PriceList" (id, name, description, "isDefault", "isActive", "createdAt", "updatedAt") FROM stdin;
cmihpra7p0002hlhn1gg7dyv9	Público General	Precios para clientes generales	t	t	2025-11-27 17:34:40.502	2025-11-27 17:34:40.502
cmihpra7x0003hlhnftq1u5s0	San Alas	Precios especiales para negocio propio San Alas	f	t	2025-11-27 17:34:40.509	2025-11-27 17:34:40.509
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Product" (id, name, description, sku, barcode, "categoryId", "defaultPrice", cost, "imageUrl", "baseUnit", "baseStock", "minStock", "isActive", "createdAt", "updatedAt", "barcodeImageUrl", "barcodeImageRotation", "barcodeImageScale", "priceEmpleados", "priceSanAlas") FROM stdin;
cmiiipl0x0001zbn2tm9vy57n	fgdsgdsfg	\N	\N	7707295760000	cmiigcdon0004a6e2ih0ga1e3	4000.00	1000.00	/uploads/products/e911acca-adac-4bd7-b7ac-82f27ea10b68.png	unidad	78.000	0	f	2025-11-28 07:05:10.065	2025-11-28 13:51:59.6	\N	0	1	\N	\N
cmiih6t0l0001j39fgoduz4ih	Chokis	\N	\N	\N	cmiigcdon0004a6e2ih0ga1e3	3000.00	2035.71	/uploads/products/9ae5eae0-dad0-486b-b5d7-9472c312ab65.jpg	libra	310.000	100	f	2025-11-28 06:22:34.341	2025-11-28 14:20:54.505	\N	0	1	\N	\N
cmihr2igt000fb6s8e1988lxb	pruf	\N	\N	\N	cmihpra830004hlhnje45gonv	3000.00	100.00		unidad	50.000	10	f	2025-11-27 18:11:24.029	2025-11-29 00:22:01.972	\N	0	1	\N	\N
cmij4he79000llb68p8b5lqfq	Palillos De Dientes	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	1000.00	1.00	/uploads/products/42873c66-b069-4481-b698-242cbd97138b.png	paquete	100.000	0	t	2025-11-28 17:14:39.524	2025-11-28 17:20:46.869	\N	0	1	\N	\N
cmihq1k4c0001b6s8zi03fazj	dafewf	\N	\N	\N	cmihpra8n0007hlhn1w7fbzxo	22.00	2.00		unidad	10.000	0	f	2025-11-27 17:42:39.9	2025-11-29 00:21:56.201	\N	0	1	\N	\N
cmiixm3bz000114810vb3e79e	Coca Cola 10	\N	\N	7702535024423	cmihpra830004hlhnje45gonv	5000.00	2000.00	/uploads/products/6a822e87-0324-4c13-b81f-1c92b3495874.png	unidad	299.000	100	f	2025-11-28 14:02:21.407	2025-11-28 16:31:17.606	\N	0	1	\N	\N
cmij8dbto0022lb68y6y1n0t4	Bolsa De Basura Individual 	\N	\N	\N	cmij7xwul001ilb68825py611	300.00	1.00		unidad	100.000	0	t	2025-11-28 19:03:28.27	2025-11-28 19:03:28.27	\N	0	1	\N	\N
cmij7bwsg000tlb680ct4d4lu	Pitillo Forrado	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	7000.00	1.00	/uploads/products/492f7354-c764-4cd4-a122-96866edb17a4.png	paquete	100.000	0	t	2025-11-28 18:34:22.526	2025-11-28 19:27:37.065	\N	0	1	\N	\N
cmij2xhz20008lb68y9et5qls	Servilletas Nube x300 	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	4500.00	1.00	/uploads/products/2dafdb46-46a7-417f-9451-3c28699a8626.png	paquete	100.000	0	t	2025-11-28 16:31:11.678	2025-11-28 16:38:18.909	\N	0	1	\N	\N
cmij34i89000alb68o3i9ml64	Servilletas Nube Dis x150	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	2500.00	2500.00	/uploads/products/004b813e-7309-4271-b7bb-2a045b01a19b.png	paquete	100.000	0	t	2025-11-28 16:36:38.559	2025-11-28 16:45:52.465	\N	0	1	\N	\N
cmij3ju15000clb68mo7uu624	Guantes Trans x100	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	2500.00	1.00	/uploads/products/94ea1131-1af5-4682-a355-5736f8649ad9.png	paquete	100.000	0	t	2025-11-28 16:48:33.722	2025-11-28 16:49:28.434	\N	0	1	\N	\N
cmij7ggnu000zlb68ey2t2oos	Pitillo Mezclador	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	2500.00	1.00	/uploads/products/a25269af-8e81-4faf-8198-37437bcf9c8b.png	paquete	100.000	0	t	2025-11-28 18:37:54.904	2025-11-28 21:51:03.268	\N	0	1	\N	\N
cmij3nbqk000elb68s8hwdxuk	Guantes Negros	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	500.00	1.00	/uploads/products/313c8b6a-e95b-4820-8fe9-744a6b15493b.png	paquete	100.000	0	t	2025-11-28 16:51:16.652	2025-11-28 16:57:12.066	\N	0	1	\N	\N
cmij3qgg3000glb68a72j7byb	Palos Paletas Millar	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	17000.00	1.00	/uploads/products/ef82f12e-7d5a-4db0-bafc-90c27a40b804.png	paquete	100.000	0	t	2025-11-28 16:53:42.723	2025-11-28 17:00:41.391	\N	0	1	\N	\N
cmij3t4x8000jlb68z96gpev2	Palos Paletas x50	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	1500.00	1.00	/uploads/products/5d4e3cc6-7132-427e-8843-20f32ef550ea.png	paquete	100.000	0	t	2025-11-28 16:55:47.756	2025-11-28 17:02:34.723	\N	0	1	\N	\N
cmij7cqst000vlb68zqtayysc	Pitillo De Gaseosa	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	1500.00	1.00	/uploads/products/9ad8e714-0b2f-42dd-b4e9-c9b18254b0dc.jpeg	paquete	99.000	0	t	2025-11-28 18:35:01.421	2025-11-29 00:11:03.604	\N	0	1	\N	\N
cmij7ihnb0011lb68kevghxiz	Aluminio x 8m	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	3500.00	1.00		unidad	100.000	0	t	2025-11-28 18:39:29.473	2025-11-28 18:39:29.473	\N	0	1	\N	\N
cmij7m8aa0013lb68lcn9dhqh	Aluminio x 16m	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	6500.00	1.00		unidad	100.000	0	t	2025-11-28 18:42:23.985	2025-11-28 18:42:23.985	\N	0	1	\N	\N
cmij7nsy00015lb68pzqodtni	Aluminio x 40m	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	12000.00	1.00		unidad	100.000	0	t	2025-11-28 18:43:37.416	2025-11-28 18:44:08.323	\N	0	1	\N	\N
cmij7pzaw0017lb6874swaq7d	Vinipel x 100m	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	4800.00	1.00		unidad	100.000	0	t	2025-11-28 18:45:18.931	2025-11-28 18:45:18.931	\N	0	1	\N	\N
cmij7qi8m0019lb68r91dep31	Vinipel x 300m 	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	11000.00	1.00		unidad	100.000	0	t	2025-11-28 18:45:43.509	2025-11-28 18:45:43.509	\N	0	1	\N	\N
cmij7r1jt001blb68ngl9ewt9	Chicle Negro	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	6500.00	1.00		unidad	100.000	0	t	2025-11-28 18:46:08.537	2025-11-28 18:46:08.537	\N	0	1	\N	\N
cmij7smek001flb68oiss7jxn	Chicle x 20cm x 500m	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	13000.00	1.00		unidad	100.000	0	t	2025-11-28 18:47:22.22	2025-11-28 18:47:22.22	\N	0	1	\N	\N
cmij7rytc001dlb680cgvzl1k	Chicle x 12,5cm x  300m 	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	7000.00	1.00		unidad	100.000	0	t	2025-11-28 18:46:51.647	2025-11-28 18:49:47.571	\N	0	1	\N	\N
cmij7wdno001hlb68rvsupzgp	Recipiente Salsero	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	1500.00	1.00		unidad	100.000	0	t	2025-11-28 18:50:17.507	2025-11-28 18:50:17.507	\N	0	1	\N	\N
cmij7zx5l001mlb68sru6pes8	7/10 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	1500.00	1.00		paquete	100.000	0	t	2025-11-28 18:53:02.745	2025-11-28 18:53:02.745	\N	0	1	\N	\N
cmihqy9um0003b6s8ukd2k58t	sdfsdf	\N	\N	\N	cmihpra8n0007hlhn1w7fbzxo	22.00	1.00		kg	500.000	50	f	2025-11-27 18:08:06.238	2025-11-29 00:21:57.89	\N	0	1	\N	\N
cmij7yj6k001klb68mgrvahno	6/6 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	1200.00	1.00		paquete	100.000	0	t	2025-11-28 18:51:57.98	2025-11-28 18:54:44.054	\N	0	1	\N	\N
cmij82pne001olb68jcid1pxv	8/12 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	2000.00	1.00		paquete	100.000	0	t	2025-11-28 18:55:12.986	2025-11-28 18:55:12.986	\N	0	1	\N	\N
cmij83af1001qlb6896s38bt6	10/14 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	3000.00	1.00		paquete	100.000	0	t	2025-11-28 18:55:39.901	2025-11-28 18:55:39.901	\N	0	1	\N	\N
cmij84355001slb68y9ztbna8	12/16 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	4000.00	1.00		paquete	100.000	0	t	2025-11-28 18:56:17.129	2025-11-28 18:56:17.129	\N	0	1	\N	\N
cmij84mm1001ulb68zowcgiv3	14/20 Planas	\N	\N	\N	cmij7xwul001ilb68825py611	6500.00	1.00		paquete	100.000	0	t	2025-11-28 18:56:42.335	2025-11-28 18:56:42.335	\N	0	1	\N	\N
cmij860xy001wlb68os7zvxr1	15/22 Papelera	\N	\N	\N	cmij7xwul001ilb68825py611	12000.00	1.00		paquete	100.000	0	t	2025-11-28 18:57:47.566	2025-11-28 18:57:47.566	\N	0	1	\N	\N
cmij86nus001ylb68dj6jjggg	Bolsas De Basura x 50	\N	\N	\N	cmij7xwul001ilb68825py611	8000.00	1.00		paquete	100.000	0	t	2025-11-28 18:58:17.284	2025-11-28 18:58:17.284	\N	0	1	\N	\N
cmij8cd6c0020lb68jjie38w6	Bolsas De Basura x 5	\N	\N	\N	cmij7xwul001ilb68825py611	1000.00	1.00		paquete	100.000	0	t	2025-11-28 19:02:43.38	2025-11-28 19:02:43.38	\N	0	1	\N	\N
cmij8e2u40024lb68xvnsfmzc	Bolsas Jumbo x 50	\N	\N	\N	cmij7xwul001ilb68825py611	35000.00	1.00		paquete	100.000	0	t	2025-11-28 19:04:03.292	2025-11-28 19:04:03.292	\N	0	1	\N	\N
cmij8eqag0026lb68qqwm2k38	Bolsas Jumbo x 5	\N	\N	\N	cmij7xwul001ilb68825py611	4000.00	1.00		paquete	100.000	0	t	2025-11-28 19:04:33.688	2025-11-28 19:04:33.688	\N	0	1	\N	\N
cmij8fiw50028lb68dymb7qvz	Bolsa Jumbo Individual	\N	\N	\N	cmij7xwul001ilb68825py611	1000.00	1.00		unidad	100.000	0	t	2025-11-28 19:05:10.757	2025-11-28 19:05:10.757	\N	0	1	\N	\N
cmij4i3do000nlb68fup8z4se	Palillos De Hamburguesa	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	2000.00	1.00	/uploads/products/413a4406-31cb-4e6b-9aa4-5b171fd4ed7a.png	paquete	99.000	0	t	2025-11-28 17:15:12.156	2025-11-29 00:09:39.317	\N	0	1	\N	\N
cmij9ch2s002clb683ognmj2r	T15	\N	\N	\N	cmij7xwul001ilb68825py611	3500.00	1.00		paquete	100.000	0	t	2025-11-28 19:30:48.051	2025-11-28 19:31:08.019	\N	0	1	\N	\N
cmij9gr5h002elb68angpqsrh	T20 	\N	\N	\N	cmij7xwul001ilb68825py611	4000.00	1.00		paquete	100.000	0	t	2025-11-28 19:34:07.733	2025-11-28 19:34:07.733	\N	0	1	\N	\N
cmij9ihh2002glb68m1ozklxy	T25	\N	\N	\N	cmij7xwul001ilb68825py611	5000.00	1.00		paquete	100.000	0	t	2025-11-28 19:35:28.501	2025-11-28 19:35:28.501	\N	0	1	\N	\N
cmij9j1u2002ilb6805ugudjv	T30	\N	\N	\N	cmij7xwul001ilb68825py611	7000.00	1.00		paquete	100.000	0	t	2025-11-28 19:35:54.873	2025-11-28 19:35:54.873	\N	0	1	\N	\N
cmij9k8a5002klb6810rz8xjr	T40	\N	\N	\N	cmij7xwul001ilb68825py611	12000.00	1.00		paquete	100.000	0	t	2025-11-28 19:36:49.9	2025-11-28 19:36:49.9	\N	0	1	\N	\N
cmij9kzpy002mlb68kaew3bhw	T50	\N	\N	\N	cmij7xwul001ilb68825py611	16000.00	1.00		paquete	100.000	0	t	2025-11-28 19:37:25.46	2025-11-28 19:37:25.46	\N	0	1	\N	\N
cmij9peoz002olb68h864640m	#1/2 Papel	\N	\N	\N	cmij7xwul001ilb68825py611	3300.00	1.00		paquete	100.000	0	t	2025-11-28 19:40:51.491	2025-11-28 19:40:51.491	\N	0	1	\N	\N
cmij9q4ab002qlb68i694qtp9	#1 Papel	\N	\N	\N	cmij7xwul001ilb68825py611	3800.00	1.00		paquete	100.000	0	t	2025-11-28 19:41:24.647	2025-11-28 19:41:24.647	\N	0	1	\N	\N
cmij9r49t002slb68hhvs48i1	#2 Papel	\N	\N	\N	cmij7xwul001ilb68825py611	4800.00	1.00		paquete	100.000	0	t	2025-11-28 19:42:11.297	2025-11-28 19:42:11.297	\N	0	1	\N	\N
cmij9rk8i002ulb680ae3sx1u	#3 Papel	\N	\N	\N	cmij7xwul001ilb68825py611	6000.00	1.00		paquete	100.000	0	t	2025-11-28 19:42:31.985	2025-11-28 19:42:41.864	\N	0	1	\N	\N
cmij9sjbi002wlb68n9zjj2v7	2/10 Bolis 	\N	\N	\N	cmij7xwul001ilb68825py611	1200.00	1.00		paquete	100.000	0	t	2025-11-28 19:43:17.453	2025-11-28 19:43:17.453	\N	0	1	\N	\N
cmij9t1dt002ylb68oop6lov1	1/1 Cierre	\N	\N	\N	cmij7xwul001ilb68825py611	1800.00	1.00		paquete	100.000	0	t	2025-11-28 19:43:40.864	2025-11-28 19:43:40.864	\N	0	1	\N	\N
cmij9tq1e0032lb68xevuoox6	2/2 Cierre 	\N	\N	\N	cmij7xwul001ilb68825py611	1800.00	1.00		paquete	100.000	0	t	2025-11-28 19:44:12.818	2025-11-28 19:44:12.818	\N	0	1	\N	\N
cmij9udwi0034lb68bw1lduvp	4/8 Cierre	\N	\N	\N	cmij7xwul001ilb68825py611	7000.00	1.00		paquete	100.000	0	t	2025-11-28 19:44:43.746	2025-11-28 19:44:43.746	\N	0	1	\N	\N
cmij9ux630036lb68w41wzk0g	8/12 Cierre	\N	\N	\N	cmij7xwul001ilb68825py611	17000.00	1.00		paquete	100.000	0	t	2025-11-28 19:45:08.715	2025-11-28 19:45:08.715	\N	0	1	\N	\N
cmij9vh0c0038lb68swop8sxs	3/10 Transparente	\N	\N	\N	cmij7xwul001ilb68825py611	2000.00	1.00		paquete	100.000	0	t	2025-11-28 19:45:34.428	2025-11-28 19:45:34.428	\N	0	1	\N	\N
cmij9waik003alb68hpok8saz	3/14 Transparente	\N	\N	\N	cmij7xwul001ilb68825py611	2500.00	1.00		paquete	100.000	0	t	2025-11-28 19:46:12.668	2025-11-28 19:46:12.668	\N	0	1	\N	\N
cmij9x92i003clb68dfkuejtt	4/16 Transparente	\N	\N	\N	cmij7xwul001ilb68825py611	2500.00	1.00		paquete	100.000	0	t	2025-11-28 19:46:57.436	2025-11-28 19:46:57.436	\N	0	1	\N	\N
cmijbfk0w0001hw3yoz04yg6y	5/14 Transparente	\N	\N	\N	cmij7xwul001ilb68825py611	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:29:11.072	2025-11-28 20:29:41.173	\N	0	1	\N	\N
cmijbh4t90003hw3yh7iaya0y	6/6 Metal	\N	\N	\N	cmij7xwul001ilb68825py611	3000.00	1.00		paquete	100.000	0	t	2025-11-28 20:30:24.669	2025-11-28 20:30:24.669	\N	0	1	\N	\N
cmijbj16a0005hw3yb1czzlyy	7/10 Metal	\N	\N	\N	cmij7xwul001ilb68825py611	5000.00	1.00		paquete	100.000	0	t	2025-11-28 20:31:53.266	2025-11-28 20:31:53.266	\N	0	1	\N	\N
cmijbjkyc0007hw3ykrmdetnx	8/12 Metal	\N	\N	\N	cmij7xwul001ilb68825py611	7000.00	1.00		paquete	100.000	0	t	2025-11-28 20:32:18.9	2025-11-28 20:32:18.9	\N	0	1	\N	\N
cmijbk64t0009hw3ygozk87k5	10/14 Metal	\N	\N	\N	cmij7xwul001ilb68825py611	12000.00	1.00		paquete	100.000	0	t	2025-11-28 20:32:46.349	2025-11-28 20:32:46.349	\N	0	1	\N	\N
cmijblh8n000chw3yy8hpzo76	#1/2 Copa	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:33:47.386	2025-11-28 20:33:47.386	\N	0	1	\N	\N
cmijbm0ce000ehw3ypfe70wi3	#1/2 Tapa	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:34:12.158	2025-11-28 20:34:12.158	\N	0	1	\N	\N
cmijbmldw000ghw3yv82ow5lu	#1.5 Copa	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2000.00	1.00		paquete	100.000	0	t	2025-11-28 20:34:39.428	2025-11-28 20:34:39.428	\N	0	1	\N	\N
cmijbn8w7000ihw3y3eapgvaq	3.5 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:35:09.893	2025-11-28 20:35:09.893	\N	0	1	\N	\N
cmijbnuo2000khw3ywztbewcn	5 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:35:38.115	2025-11-28 20:35:38.115	\N	0	1	\N	\N
cmijbocvh000mhw3y1pzgf9ca	7 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	2500.00	1.00		paquete	100.000	0	t	2025-11-28 20:36:01.709	2025-11-28 20:36:01.709	\N	0	1	\N	\N
cmijbouti000ohw3y26s8dovx	9 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:36:24.966	2025-11-28 20:36:24.966	\N	0	1	\N	\N
cmijbpcqn000qhw3yq4uqrts1	10 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:36:48.191	2025-11-28 20:36:48.191	\N	0	1	\N	\N
cmijbpvxd000shw3yaz9upjwk	12 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	4000.00	1.00		paquete	100.000	0	t	2025-11-28 20:37:13.056	2025-11-28 20:37:13.056	\N	0	1	\N	\N
cmijbqsd7000uhw3yxchdr13r	14 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:37:55.096	2025-11-28 20:37:55.096	\N	0	1	\N	\N
cmijbrll2000whw3yhm2yf4yl	16 Onzas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:38:32.966	2025-11-28 20:38:32.966	\N	0	1	\N	\N
cmijbs7kl000yhw3ys9s3uahd	14/16 Tapas	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:39:01.448	2025-11-28 20:39:01.448	\N	0	1	\N	\N
cmijbsuf80010hw3y35y7aa2o	Copa Brindis	\N	\N	\N	cmijbkui8000ahw3yyhxhcy2n	15000.00	1.00		paquete	100.000	0	t	2025-11-28 20:39:31.075	2025-11-28 20:39:31.075	\N	0	1	\N	\N
cmijbvbct0013hw3yvk0si0lh	5 P 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	2000.00	1.00		paquete	100.000	0	t	2025-11-28 20:41:26.333	2025-11-28 20:41:26.333	\N	0	1	\N	\N
cmijbwi600015hw3ye3g7gg47	5 H 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	2000.00	1.00		paquete	100.000	0	t	2025-11-28 20:42:21.816	2025-11-28 20:42:21.816	\N	0	1	\N	\N
cmijbyau60017hw3y42443qyi	15 H 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	3000.00	1.00		paquete	100.000	0	t	2025-11-28 20:43:45.629	2025-11-28 20:43:45.629	\N	0	1	\N	\N
cmijbz3f60019hw3yah7evofm	16 P 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	3000.00	1.00		paquete	100.000	0	t	2025-11-28 20:44:22.644	2025-11-28 20:44:22.644	\N	0	1	\N	\N
cmijbzx3x001bhw3yjw3ivrgl	18 P 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	4000.00	1.00		paquete	100.000	0	t	2025-11-28 20:45:01.149	2025-11-28 20:45:01.149	\N	0	1	\N	\N
cmijc1aiu001dhw3ye9jj5ov2	23 H Canoa	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	3500.00	1.00		paquete	100.000	0	t	2025-11-28 20:46:05.189	2025-11-28 20:46:05.189	\N	0	1	\N	\N
cmijc1x5p001fhw3y7sb7tg9r	23 P	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	5000.00	1.00		paquete	100.000	0	t	2025-11-28 20:46:34.525	2025-11-28 20:46:34.525	\N	0	1	\N	\N
cmijc2dem001hhw3yzpg4xdcz	23 D 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	5000.00	1.00		paquete	100.000	0	t	2025-11-28 20:46:55.582	2025-11-28 20:46:55.582	\N	0	1	\N	\N
cmijc33f3001jhw3ya3ryed2e	26 P 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	6500.00	1.00		paquete	100.000	0	t	2025-11-28 20:47:29.295	2025-11-28 20:47:29.295	\N	0	1	\N	\N
cmijc3hgt001lhw3ybhb6oaer	30 H 	\N	\N	\N	cmijbtb8e0011hw3yhe7zlyio	6500.00	1.00		paquete	100.000	0	t	2025-11-28 20:47:47.501	2025-11-28 20:47:47.501	\N	0	1	\N	\N
cmijc7ov2001ohw3yamvkzhms	P3 x 200	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	88000.00	1.00		paquete	100.000	0	t	2025-11-28 20:51:03.697	2025-11-28 20:51:03.697	\N	0	1	\N	\N
cmijc9xbi001qhw3y1jxsrupt	P3 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	5000.00	1.00		paquete	100.000	0	t	2025-11-28 20:52:47.982	2025-11-28 20:52:47.982	\N	0	1	\N	\N
cmijejqqh001shw3y5zyipt56	P1 x 200	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	88000.00	1.00		paquete	100.000	0	t	2025-11-28 21:56:25.224	2025-11-28 21:56:25.224	\N	0	1	\N	\N
cmijekbaj001uhw3yl9pgslyz	P1 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	5000.00	1.00		paquete	100.000	0	t	2025-11-28 21:56:51.883	2025-11-28 21:56:51.883	\N	0	1	\N	\N
cmijel2pd001whw3yczs4q1ya	J1 x 200	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	78000.00	1.00		paquete	100.000	0	t	2025-11-28 21:57:27.407	2025-11-28 21:57:27.407	\N	0	1	\N	\N
cmijelj07001yhw3yshb6pvlw	J1 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	4500.00	1.00		paquete	100.000	0	t	2025-11-28 21:57:48.535	2025-11-28 21:57:48.535	\N	0	1	\N	\N
cmijem6ff0020hw3y6d0dc4bf	J2 x 200	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	78000.00	1.00		paquete	100.000	0	t	2025-11-28 21:58:18.891	2025-11-28 21:58:18.891	\N	0	1	\N	\N
cmijemogi0022hw3y59cidebk	J2 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	4500.00	1.00		paquete	100.000	0	t	2025-11-28 21:58:42.258	2025-11-28 21:58:42.258	\N	0	1	\N	\N
cmijenbtm0024hw3yilz2yhpg	C1  x 500	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	118000.00	1.00		paquete	100.000	0	t	2025-11-28 21:59:12.538	2025-11-28 21:59:12.538	\N	0	1	\N	\N
cmijenuel0026hw3yw50ljfwj	C1 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	3500.00	1.00		paquete	100.000	0	t	2025-11-28 21:59:36.621	2025-11-28 21:59:36.621	\N	0	1	\N	\N
cmijeoh5n0028hw3yljg3k27l	K1 x 200	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	68000.00	1.00		paquete	100.000	0	t	2025-11-28 22:00:06.107	2025-11-28 22:00:06.107	\N	0	1	\N	\N
cmijeovhb002ahw3yelffuhe0	K1 x 10	\N	\N	\N	cmijc58ww001mhw3yjyn7syuq	4000.00	1.00		paquete	100.000	0	t	2025-11-28 22:00:24.672	2025-11-28 22:00:24.672	\N	0	1	\N	\N
cmijeq6f4002dhw3ypvkysr21	#1 	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	2500.00	1.00		paquete	100.000	0	t	2025-11-28 22:01:25.474	2025-11-28 22:01:50.342	\N	0	1	\N	\N
cmijer7sd002fhw3yg91r7uzj	#1-1	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	2500.00	1.00		paquete	100.000	0	t	2025-11-28 22:02:13.933	2025-11-28 22:02:13.933	\N	0	1	\N	\N
cmijes7rd002hhw3yr4u5lwvc	#3	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	3000.00	1.00		paquete	100.000	0	t	2025-11-28 22:03:00.551	2025-11-28 22:03:00.551	\N	0	1	\N	\N
cmijeulf1002jhw3y5hzfax65	#5	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	4500.00	1.00		paquete	100.000	0	t	2025-11-28 22:04:51.565	2025-11-28 22:04:51.565	\N	0	1	\N	\N
cmijevblz002lhw3ywf373dmx	#7	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	4000.00	1.00		paquete	100.000	0	t	2025-11-28 22:05:25.51	2025-11-28 22:05:25.51	\N	0	1	\N	\N
cmijevvd2002nhw3yzryi8l6w	#10	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	6000.00	1.00		paquete	100.000	0	t	2025-11-28 22:05:51.11	2025-11-28 22:05:51.11	\N	0	1	\N	\N
cmijewwbb002rhw3yauiiy41e	#17	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	3500.00	1.00		paquete	100.000	0	t	2025-11-28 22:06:38.999	2025-11-28 22:06:38.999	\N	0	1	\N	\N
cmijexmr3002thw3yeryn6bfi	#19.5	\N	\N	\N	cmijepaiw002bhw3y6qt8xvaz	5500.00	1.00		paquete	100.000	0	t	2025-11-28 22:07:13.259	2025-11-28 22:07:13.259	\N	0	1	\N	\N
cmijf0eaq002whw3yalmvy1xq	Cuchara Grande x 100	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	6000.00	1.00		paquete	100.000	0	t	2025-11-28 22:09:22.274	2025-11-28 22:11:13.652	\N	0	1	\N	\N
cmijf1hz7002yhw3ygrx0luvm	Cuchara Grande x 20	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	2000.00	1.00		paquete	100.000	0	t	2025-11-28 22:10:13.699	2025-11-28 22:11:35.562	\N	0	1	\N	\N
cmijf3uim0030hw3y8ote99o0	Cuchara Pequeña x 100	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	3500.00	1.00		paquete	100.000	0	t	2025-11-28 22:12:03.262	2025-11-28 22:12:03.262	\N	0	1	\N	\N
cmijf52y40032hw3yp5za9i6r	Tenedor Grande x 100 	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	6000.00	1.00		paquete	100.000	0	t	2025-11-28 22:13:00.822	2025-11-28 22:13:00.822	\N	0	1	\N	\N
cmijf5lm80034hw3ykqxy6kmd	Tenedor Pequeño x 100	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	1000.00	1.00		paquete	100.000	0	t	2025-11-28 22:13:25.04	2025-11-28 22:13:25.04	\N	0	1	\N	\N
cmijf71yp0038hw3y8nv3tjbw	Cuchillo x 20	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	2000.00	1.00		paquete	100.000	0	t	2025-11-28 22:14:32.881	2025-11-28 22:14:32.881	\N	0	1	\N	\N
cmijf6fdz0036hw3y7pbob83e	Cuchillo x 100	\N	\N	\N	cmijezcac002uhw3ypduw4tnf	6000.00	60.40		paquete	101.000	0	t	2025-11-28 22:14:03.623	2025-11-28 22:24:59.403	\N	0	1	\N	\N
cmijf8dq1003bhw3yayllqcpx	 #12 Sopa	\N	\N	\N	cmijf7ou90039hw3yh518pga3	14000.00	275.49		paquete	99.000	0	t	2025-11-28 22:15:34.777	2025-11-28 23:54:18.014	\N	0	1	\N	\N
cmij4oh09000rlb68qzqtu5xf	Palo De Chuzo Grueso	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	6500.00	1.00	/uploads/products/69bfa5b7-8e75-4425-875b-c4dfb8b3d08d.png	paquete	99.000	0	t	2025-11-28 17:20:09.752	2025-11-29 00:09:39.325	\N	0	1	\N	\N
cmij4nm62000plb68ujksvki9	Palo De Pincho 25 cm	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	3500.00	1.00	/uploads/products/b726d05c-1a4f-45dd-9cc7-51abe2a3be6f.png	paquete	99.000	0	t	2025-11-28 17:19:29.784	2025-11-29 00:09:39.331	\N	0	1	\N	\N
cmij7dqjn000xlb68c05zr45c	Pitillo De Colores	\N	\N	\N	cmij2rcqs0002lb68i4lopgn7	2500.00	1.00	/uploads/products/93513eb0-84f5-491a-b17b-05327dc00681.webp	paquete	98.000	0	t	2025-11-28 18:35:47.746	2025-11-29 00:11:03.608	\N	0	1	\N	\N
\.


--
-- Data for Name: ProductPresentation; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."ProductPresentation" (id, "productId", name, quantity, price, "priceSanAlas", barcode, "sortOrder", "isDefault", "isActive", "createdAt", "updatedAt", "priceEmpleados") FROM stdin;
cmihrbjop000sb6s8ysbf4gm0	cmihr2igt000fb6s8e1988lxb	paquete	10.000	500.00	1000.00	\N	0	t	t	2025-11-27 18:18:25.514	2025-11-28 05:11:42.697	\N
cmiih6t0m0004j39fae0m53vy	cmiih6t0l0001j39fgoduz4ih	Paca	30.000	60000.00	55000.00	\N	0	t	t	2025-11-28 06:22:34.341	2025-11-28 06:22:34.341	\N
cmiixm3bz00041481xoo48o6m	cmiixm3bz000114810vb3e79e	3 litros	10.000	6000.00	5000.00	\N	0	t	t	2025-11-28 14:02:21.407	2025-11-28 14:02:21.407	\N
\.


--
-- Data for Name: ProductPrice; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."ProductPrice" (id, "productId", "priceListId", price, "createdAt", "updatedAt") FROM stdin;
cmihqy9um0005b6s85gu3ughy	cmihqy9um0003b6s8ukd2k58t	cmihpra7x0003hlhnftq1u5s0	23.00	2025-11-27 18:08:06.238	2025-11-27 18:08:06.238
cmihr2igt000hb6s81t8cahuz	cmihr2igt000fb6s8e1988lxb	cmihpra7x0003hlhnftq1u5s0	2000.00	2025-11-27 18:11:24.029	2025-11-28 05:11:42.665
cmiih6t0l0003j39flj1n7q9y	cmiih6t0l0001j39fgoduz4ih	cmihpra7x0003hlhnftq1u5s0	2500.00	2025-11-28 06:22:34.341	2025-11-28 06:22:34.341
cmiiipl0x0003zbn2pz9yt2ij	cmiiipl0x0001zbn2tm9vy57n	cmihpra7x0003hlhnftq1u5s0	2000.00	2025-11-28 07:05:10.065	2025-11-28 07:05:10.065
cmiixm3bz00031481qo2c117p	cmiixm3bz000114810vb3e79e	cmihpra7x0003hlhnftq1u5s0	3000.00	2025-11-28 14:02:21.407	2025-11-28 14:02:21.407
\.


--
-- Data for Name: Purchase; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Purchase" (id, "purchaseNumber", date, "supplierId", "supplierName", "warehouseId", subtotal, tax, discount, total, status, "invoiceNumber", notes, "createdAt", "userId") FROM stdin;
cmiihg2rq000kj39f895kjl3n	6	2025-11-28 06:29:46.886	cmiihf9sf000hj39fuw44jjzt	ARROZ	cmihpra7i0001hlhn4unyn7s0	30000.00	0.00	0.00	30000.00	RECEIVED	\N	\N	2025-11-28 06:29:46.886	cmihpra760000hlhnjc842qcd
cmijfjf8e003ehw3y4k4i12fh	7	2025-11-28 22:24:09.947	\N	\N	cmihpra7i0001hlhn4unyn7s0	14000.00	0.00	0.00	14000.00	RECEIVED	\N	\N	2025-11-28 22:24:09.947	cmihpra760000hlhnjc842qcd
cmijfjvx200023l344jcczgig	8	2025-11-28 22:24:31.574	cmihr20ez000db6s8cy4ihpl9	juan	cmihpra7i0001hlhn4unyn7s0	14000.00	0.00	0.00	14000.00	RECEIVED	\N	\N	2025-11-28 22:24:31.574	cmihpra760000hlhnjc842qcd
cmijfkhdw00093l34tqxprh3a	9	2025-11-28 22:24:59.397	cmihr20ez000db6s8cy4ihpl9	juan	cmihpra7i0001hlhn4unyn7s0	6000.00	0.00	0.00	6000.00	RECEIVED	\N	\N	2025-11-28 22:24:59.397	cmihpra760000hlhnjc842qcd
\.


--
-- Data for Name: PurchaseItem; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."PurchaseItem" (id, "purchaseId", "productId", "productName", "presentationId", "presentationName", quantity, "baseQuantity", "unitCost", subtotal) FROM stdin;
cmiihg2ru000mj39fhjy1jjpc	cmiihg2rq000kj39f895kjl3n	cmiih6t0l0001j39fgoduz4ih	Chokis	\N	\N	10.000	10.000	3000.00	30000.00
cmijfjf97003ghw3yens6b8lm	cmijfjf8e003ehw3y4k4i12fh	cmijf8dq1003bhw3yayllqcpx	 #12 Sopa	\N	\N	1.000	1.000	14000.00	14000.00
cmijfjvx500043l34mchuzapn	cmijfjvx200023l344jcczgig	cmijf8dq1003bhw3yayllqcpx	 #12 Sopa	\N	\N	1.000	1.000	14000.00	14000.00
cmijfkhdz000b3l34lsf3nvy7	cmijfkhdw00093l34tqxprh3a	cmijf6fdz0036hw3y7pbob83e	Cuchillo x 100	\N	\N	1.000	1.000	6000.00	6000.00
\.


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Sale" (id, "saleNumber", "warehouseId", total, subtotal, domicilio, "paymentMethod", "priceType", "cashReceived", change, "createdAt", "userId") FROM stdin;
cmij1aw9a0002sfthw54g4zvr	6	cmihpra7i0001hlhn4unyn7s0	5000.00	5000.00	\N	transferencia	publico	\N	\N	2025-11-28 15:45:37.486	cmihpra760000hlhnjc842qcd
cmijirc3o0002mjtxj42yi5u9	7	cmihpra7i0001hlhn4unyn7s0	14000.00	14000.00	\N	efectivo	sanAlas	20000.00	6000.00	2025-11-28 23:54:17.989	cmihpra760000hlhnjc842qcd
cmijjb2zy0002ayuiz9yd0em7	8	cmihpra7i0001hlhn4unyn7s0	12000.00	12000.00	\N	efectivo	publico	30000.00	18000.00	2025-11-29 00:09:39.311	cmihpra760000hlhnjc842qcd
cmijjbwuu000jayui9e9qo3gm	9	cmihpra7i0001hlhn4unyn7s0	2500.00	2500.00	\N	efectivo	publico	30000.00	27500.00	2025-11-29 00:10:18.006	cmihpra760000hlhnjc842qcd
cmijjcw1c000sayui9sayq9iq	10	cmihpra7i0001hlhn4unyn7s0	4000.00	4000.00	\N	efectivo	publico	5000.00	1000.00	2025-11-29 00:11:03.601	cmihpra760000hlhnjc842qcd
\.


--
-- Data for Name: SaleItem; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."SaleItem" (id, "saleId", "productId", "presentationId", quantity, "baseQuantity", "unitPrice", subtotal) FROM stdin;
cmij1aw9t0004sfth42or6ie0	cmij1aw9a0002sfthw54g4zvr	cmiixm3bz000114810vb3e79e	\N	1.000	1.000	5000.00	5000.00
cmijirc4a0004mjtx1pmbp4tw	cmijirc3o0002mjtxj42yi5u9	cmijf8dq1003bhw3yayllqcpx	\N	1.000	1.000	14000.00	14000.00
cmijjb3030004ayuiq6w18473	cmijjb2zy0002ayuiz9yd0em7	cmij4i3do000nlb68fup8z4se	\N	1.000	1.000	2000.00	2000.00
cmijjb30a0008ayuidomzb3wl	cmijjb2zy0002ayuiz9yd0em7	cmij4oh09000rlb68qzqtu5xf	\N	1.000	1.000	6500.00	6500.00
cmijjb30h000cayuir1quumww	cmijjb2zy0002ayuiz9yd0em7	cmij4nm62000plb68ujksvki9	\N	1.000	1.000	3500.00	3500.00
cmijjbwuw000layuicwdpj3q8	cmijjbwuu000jayui9e9qo3gm	cmij7dqjn000xlb68c05zr45c	\N	1.000	1.000	2500.00	2500.00
cmijjcw1e000uayuiik1qxoj8	cmijjcw1c000sayui9sayq9iq	cmij7cqst000vlb68zqtayysc	\N	1.000	1.000	1500.00	1500.00
cmijjcw1j000yayuixtxwfkbt	cmijjcw1c000sayui9sayq9iq	cmij7dqjn000xlb68c05zr45c	\N	1.000	1.000	2500.00	2500.00
\.


--
-- Data for Name: StockLevel; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."StockLevel" ("productId", "warehouseId", "onHand", "minStock") FROM stdin;
cmihqy9um0003b6s8ukd2k58t	cmihpra7i0001hlhn4unyn7s0	0.000	0.000
cmiih6t0l0001j39fgoduz4ih	cmihpra7i0001hlhn4unyn7s0	10.000	0.000
cmihr2igt000fb6s8e1988lxb	cmihpra7i0001hlhn4unyn7s0	0.000	0.000
cmijf8dq1003bhw3yayllqcpx	cmihpra7i0001hlhn4unyn7s0	2.000	0.000
cmijf6fdz0036hw3y7pbob83e	cmihpra7i0001hlhn4unyn7s0	1.000	0.000
\.


--
-- Data for Name: Supplier; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Supplier" (id, name, "contactName", phone, email, address, nit, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
cmihr20ez000db6s8cy4ihpl9	juan	\N	1231231234	asdad@gmail.com	calle110	9008367353	\N	t	2025-11-27 18:11:00.635	2025-11-27 18:11:00.635
cmiihf9sf000hj39fuw44jjzt	ARROZ	\N	12312312	dwasfasd@gmail.com	calle110-47	90002349432	\N	t	2025-11-28 06:29:09.327	2025-11-28 06:29:09.327
\.


--
-- Data for Name: SupplierPendingIssue; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."SupplierPendingIssue" (id, "supplierId", "purchaseId", type, description, amount, "isResolved", "resolvedAt", "resolvedNotes", "createdAt", "updatedAt", "resolvedByUserId", "userId") FROM stdin;
cmiihhtvj000zj39frqhnz2q9	cmiihf9sf000hj39fuw44jjzt	\N	devolucion	me debe 1 caja de aeite	12000.00	t	2025-11-28 06:31:51.952	Resuelto	2025-11-28 06:31:08.671	2025-11-28 06:31:51.953	\N	\N
cmihtzilm0008zug0wvt98ah3	cmihr20ez000db6s8cy4ihpl9	cmihtzikn0002zug08pq7eftd	productos_malos	devolucion productos malos	\N	t	2025-11-28 22:33:19.094	Resuelto	2025-11-27 19:33:03.082	2025-11-28 22:33:19.095	\N	\N
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."User" (id, "passwordHash", "isActive", "createdAt", "updatedAt", username, name, role) FROM stdin;
cmihpra760000hlhnjc842qcd	$2a$10$0QHrbX/jz08bIW3hGjKtV.EYthLzKzoAvgSxBCPatxsJm1KDyC0pq	t	2025-11-27 17:34:40.483	2025-11-27 17:34:40.483	admin	\N	operario
\.


--
-- Data for Name: Warehouse; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public."Warehouse" (id, name, "createdAt", "updatedAt") FROM stdin;
cmihpra7i0001hlhn4unyn7s0	Principal	2025-11-27 17:34:40.495	2025-11-27 17:34:40.495
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: zora
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0983e438-4edf-4e01-8fac-f61d4968d0a3	fd027ff61a9c0c21a4e89042b380ae2d4eb900f1ed239e1870856264858440f8	2025-11-27 17:34:27.073218+00	20251127173316_init_baseline	\N	\N	2025-11-27 17:34:26.705914+00	1
\.


--
-- Name: Loan_loanNumber_seq; Type: SEQUENCE SET; Schema: public; Owner: zora
--

SELECT pg_catalog.setval('public."Loan_loanNumber_seq"', 1, true);


--
-- Name: Purchase_purchaseNumber_seq; Type: SEQUENCE SET; Schema: public; Owner: zora
--

SELECT pg_catalog.setval('public."Purchase_purchaseNumber_seq"', 9, true);


--
-- Name: Sale_saleNumber_seq; Type: SEQUENCE SET; Schema: public; Owner: zora
--

SELECT pg_catalog.setval('public."Sale_saleNumber_seq"', 10, true);


--
-- Name: CashMovement CashMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashMovement"
    ADD CONSTRAINT "CashMovement_pkey" PRIMARY KEY (id);


--
-- Name: CashSession CashSession_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashSession"
    ADD CONSTRAINT "CashSession_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Employee Employee_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY (id);


--
-- Name: ExpenseCategory ExpenseCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: InventoryMovement InventoryMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY (id);


--
-- Name: LoanPayment LoanPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."LoanPayment"
    ADD CONSTRAINT "LoanPayment_pkey" PRIMARY KEY (id);


--
-- Name: Loan Loan_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PriceList PriceList_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."PriceList"
    ADD CONSTRAINT "PriceList_pkey" PRIMARY KEY (id);


--
-- Name: ProductPresentation ProductPresentation_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ProductPresentation"
    ADD CONSTRAINT "ProductPresentation_pkey" PRIMARY KEY (id);


--
-- Name: ProductPrice ProductPrice_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ProductPrice"
    ADD CONSTRAINT "ProductPrice_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseItem PurchaseItem_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."PurchaseItem"
    ADD CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY (id);


--
-- Name: Purchase Purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Purchase"
    ADD CONSTRAINT "Purchase_pkey" PRIMARY KEY (id);


--
-- Name: SaleItem SaleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_pkey" PRIMARY KEY (id);


--
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);


--
-- Name: StockLevel StockLevel_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."StockLevel"
    ADD CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("productId", "warehouseId");


--
-- Name: SupplierPendingIssue SupplierPendingIssue_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SupplierPendingIssue"
    ADD CONSTRAINT "SupplierPendingIssue_pkey" PRIMARY KEY (id);


--
-- Name: Supplier Supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: User User_username_key; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_username_key" UNIQUE (username);


--
-- Name: Warehouse Warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Warehouse"
    ADD CONSTRAINT "Warehouse_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: CashSession_warehouseId_closedAt_idx; Type: INDEX; Schema: public; Owner: zora
--

CREATE INDEX "CashSession_warehouseId_closedAt_idx" ON public."CashSession" USING btree ("warehouseId", "closedAt");


--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);


--
-- Name: ExpenseCategory_name_business_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "ExpenseCategory_name_business_key" ON public."ExpenseCategory" USING btree (name, business);


--
-- Name: Order_saleId_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "Order_saleId_key" ON public."Order" USING btree ("saleId");


--
-- Name: PriceList_name_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "PriceList_name_key" ON public."PriceList" USING btree (name);


--
-- Name: ProductPresentation_barcode_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "ProductPresentation_barcode_key" ON public."ProductPresentation" USING btree (barcode);


--
-- Name: ProductPresentation_productId_name_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "ProductPresentation_productId_name_key" ON public."ProductPresentation" USING btree ("productId", name);


--
-- Name: ProductPrice_productId_priceListId_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "ProductPrice_productId_priceListId_key" ON public."ProductPrice" USING btree ("productId", "priceListId");


--
-- Name: Product_barcode_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "Product_barcode_key" ON public."Product" USING btree (barcode);


--
-- Name: Product_sku_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "Product_sku_key" ON public."Product" USING btree (sku);


--
-- Name: Warehouse_name_key; Type: INDEX; Schema: public; Owner: zora
--

CREATE UNIQUE INDEX "Warehouse_name_key" ON public."Warehouse" USING btree (name);


--
-- Name: CashMovement CashMovement_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashMovement"
    ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."CashSession"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CashSession CashSession_closedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashSession"
    ADD CONSTRAINT "CashSession_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CashSession CashSession_openedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashSession"
    ADD CONSTRAINT "CashSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CashSession CashSession_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."CashSession"
    ADD CONSTRAINT "CashSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Expense Expense_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryMovement InventoryMovement_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InventoryMovement InventoryMovement_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InventoryMovement InventoryMovement_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoanPayment LoanPayment_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."LoanPayment"
    ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LoanPayment LoanPayment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."LoanPayment"
    ADD CONSTRAINT "LoanPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Order Order_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductPresentation ProductPresentation_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ProductPresentation"
    ADD CONSTRAINT "ProductPresentation_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductPrice ProductPrice_priceListId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ProductPrice"
    ADD CONSTRAINT "ProductPrice_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES public."PriceList"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductPrice ProductPrice_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."ProductPrice"
    ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseItem PurchaseItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."PurchaseItem"
    ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseItem PurchaseItem_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."PurchaseItem"
    ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public."Purchase"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Purchase Purchase_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Purchase"
    ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Purchase Purchase_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Purchase"
    ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Purchase Purchase_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Purchase"
    ADD CONSTRAINT "Purchase_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SaleItem SaleItem_presentationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES public."ProductPresentation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SaleItem SaleItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SaleItem SaleItem_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Sale Sale_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Sale Sale_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockLevel StockLevel_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."StockLevel"
    ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockLevel StockLevel_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."StockLevel"
    ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public."Warehouse"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplierPendingIssue SupplierPendingIssue_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SupplierPendingIssue"
    ADD CONSTRAINT "SupplierPendingIssue_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplierPendingIssue SupplierPendingIssue_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zora
--

ALTER TABLE ONLY public."SupplierPendingIssue"
    ADD CONSTRAINT "SupplierPendingIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: zora
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict LMaJTAm6Z5yvrMfO9clNwYGqstYp2Sdbbj9Qidi4SO3EK1bZkZ6bfz55UfJxUdk

