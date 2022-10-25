"use strict";

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use("Route");

//TESTE
Route.get("/", function () {
  return { message: "API Funcionando!" };
})

//Integração com API TOTVS
Route.get("/tel/update/:filial/:equicod", "MODS/Sl2TelController.Update");
Route.get("/mifix/consulta/ativo/:ativo", "MODS/Sl2TelController.Show");
Route.get("/ativo/qrcode/:ativo", "MODS/SLaplicIntController.ReturnQRCode");

//AWS
Route.get("/vpn/files/:type", "MODS/AwsController.Show").middleware(['jwt', 'vld:0,1']);
Route.get("/vpn/pin", "MODS/AwsController.See").middleware(['jwt', 'vld:0,1']);

//Disparar Emails
Route.get("/emails/history", "ADMIN/MailerController.Show").middleware(['jwt', 'vld:1,1'])
Route.post("/emails/dispatch/", "ADMIN/MailerController.DispatchEmail").middleware(['jwt', 'vld:1,1'])
Route.get("/emails/dispatch/", "ADMIN/MailerController.See").middleware(['jwt', 'vld:1,1'])

//Sessão
Route.post("/auth", "UserController.Login");
Route.post("/forgot", "UserController.Forgot");
Route.post("/admAuth/full", "UserController.AdmFullLogin").middleware(['jwt', 'vld:1,1']);
Route.post("/admAuth/partial", "UserController.AdmPartialLogin");
Route.get("/admAuth/logout", "UserController.AdmLogoutFilial").middleware(['jwt', 'vld:1,1']);
Route.post("/checkAuth", "UserController.ExternalAuth");

//Usuário
Route.get("/profile", "WEB/ProfileController.Show").middleware(['jwt', 'vld:0,1']);
Route.put("/profile/password", "WEB/ProfileController.ChangePassword").middleware(['jwt', 'vld:0,1']);
Route.put("/profile/email", "WEB/ProfileController.ChangeEmail").middleware(['jwt', 'vld:0,1']);
Route.put("profile/tax", "WEB/ProfileController.ChangeTax").middleware(['jwt', 'vld:0,1']);

//Leads
Route.get("/leads", "WEB/LeadController.Show").middleware(['jwt', 'vld:0,1']);
Route.get("/leads/adm", "WEB/LeadController.ShowADM").middleware(['jwt', 'vld:1,1']);
Route.get("/leads/:lead", "WEB/LeadController.See").middleware(['jwt', 'vld:0,1']);
Route.get("/leads/adm/:lead", "WEB/LeadController.SeeADM").middleware(['jwt', 'vld:1,1']);
Route.put("/leads", "WEB/LeadController.Update").middleware(['jwt', 'vld:0,1']);
Route.put("/leads/:lead/:status", "WEB/LeadController.ActiveInactive").middleware(['jwt', 'vld:1,1']);
Route.post("/leads", "WEB/LeadController.Store").middleware(['jwt', 'vld:1,1']);

//Clientes
Route.get("/client", "WEB/ClientController.Show").middleware(['jwt', 'vld:0,1']); //retorna clientes
Route.put("/client", "WEB/ClientController.Update").middleware(['jwt', 'vld:0,1']); //atualiza cliente
Route.get("/client/:CNPJ/:Tipo", "WEB/ClientController.See").middleware(['jwt', 'vld:0,1']); //mostra contagem de dados
Route.post("/client/new", "WEB/ClientController.Store").middleware(['jwt', 'vld:0,1']); //adicionar cliente
Route.put("/client/inativar", "WEB/ClientController.Inativar").middleware(['jwt', 'vld:0,1']); //inativa cliente
Route.delete("/client/deletar/:CNPJ/:COD/:LOJA", "WEB/ClientController.Destroy").middleware(['jwt', 'vld:0,1']); //apaga cliente se possivel

//Compras
Route.get("/compras/produtos", "WEB/CompraController.Produtos").middleware(['jwt', 'vld:0,1']); //retorna lista de produtos compraveis
Route.get("/compras/contas", "WEB/CompraController.Contas").middleware(['jwt', 'vld:0,1']); //retorna lista de produtos compraveis
Route.get("/compras/pedidos", "WEB/CompraController.Pedidos").middleware(['jwt', 'vld:0,1']); //retorna pedidos atendidos e abertos do cliente
Route.get("/compras/pedidos/detalhes/:ID/:STATUS", "WEB/CompraController.PedidoDet").middleware(['jwt', 'vld:0,1']); //retorna detalhes do pedido
Route.delete("/compras/pedidos/cancelar/:ID", "WEB/CompraController.Cancelar").middleware(['jwt', 'vld:0,1']); //retorna detalhes do pedido
Route.get("/compras/retriveboleto/:ID/:P", "WEB/CompraController.RetriveBoleto").middleware(['jwt', 'vld:0,1']); //retorna o pdf do pedido
Route.get("/compras/retrivenfe/:ID", "WEB/CompraController.RetriveNota").middleware(['jwt', 'vld:0,1']); //retorna o pdf do pedido
Route.post("/compras/comprar", "WEB/CompraController.Comprar").middleware(['jwt', 'vld:0,1']); //retorna detalhes do pedido
Route.post("/compras/duplicatas/report/", "WEB/CompraController.Compensar").middleware(['jwt', 'vld:0,1']); //salva arquivo de duplicatas
Route.get("/compras/pedidos/PDF/detalhes/:pedidoid/:status", "WEB/CompraController.GenPDFCompra").middleware(['jwt', 'vld:0,1']); //retorna pdf de venda
Route.get("/compras/faturamento/rotas/:CEP", "WEB/CompraController.ConsultaRota").middleware(['jwt', 'vld:0,1']); //retorna previsão de faturamento e rota

//Vendas
Route.get("/vendas/produtos", "WEB/VendaController.Produtos").middleware(['jwt', 'vld:0,1']); //retorna lista de produtos compraveis
Route.get("/vendas/pedidos", "WEB/VendaController.Show").middleware(['jwt', 'vld:0,1']); //retorna todos os pedidos de venda da filial
Route.get("/vendas/pedidos/detalhes/:serie/:pvc", "WEB/VendaController.See").middleware(['jwt', 'vld:0,1']); //retorna os detalhes de dado pedido
Route.get("/vendas/pedidos/detalhes/DOCS/:doctype/:serie/:pvc", "WEB/VendaController.RecoverDocs").middleware(['jwt', 'vld:0,1']); //retorna a DANFE solicitada
Route.get("/vendas/pedidos/detalhes/PDF/:serie/:pvc", "WEB/VendaController.GenPDFVenda").middleware(['jwt', 'vld:0,1']); //retorna pdf de venda
Route.post("/vendas/vender", "WEB/VendaController.Store").middleware(['jwt', 'vld:0,1']); //registra a venda
Route.put("/vendas/pedidos/atualizar/:pvc", "WEB/VendaController.Update").middleware(['jwt', 'vld:0,1']); //Atualiza pedido de venda
Route.put("/vendas/pedidos/cancelar/:serie/:pvc", "WEB/VendaController.CancelVenda").middleware(['jwt', 'vld:0,1']); //Cancela pedido de venda
Route.put("/vendas/pedidos/faturar/:serie/:pvc", "WEB/VendaController.RequestNFeGeneration").middleware(['jwt', 'vld:0,1']); //Solicita nota para venda

//Equipamentos
Route.get("/equip", "WEB/EquipController.Show").middleware(['jwt', 'vld:0,1']); //retorna máquinas do franqueado
Route.put("/equip", "WEB/EquipController.Update").middleware(['jwt', 'vld:0,1']); //atualiza cliente da máquina
Route.get("/equip/reports", "WEB/EquipController.See").middleware(['jwt', 'vld:0,1']); //retorna reports do franqueado
Route.post("/equip/reports", "WEB/EquipController.StoreReport").middleware(['jwt', 'vld:0,1']); //cria report do franqueado
Route.put("/equip/reports", "WEB/EquipController.DeleteReport").middleware(['jwt', 'vld:0,1']); //fecha report do franqueado
Route.get("/equip/confirm/", "WEB/EquipController.SeeConfirmInfo").middleware(['jwt', 'vld:0,1']); // retorna a lista de endereços a serem confirmados
Route.post("/equip/confirm/", "WEB/EquipController.ConfirmAddresses").middleware(['jwt', 'vld:0,1']); // grava o cnpj dos clientes com as máquinas

//Solicitação de equipamentos
Route.get("/equip/requests/own", "WEB/EquipRequestController.Show").middleware(['jwt', 'vld:0,1']); //retorna todas as requisições do grupo
Route.get("/equip/requests/adresses", "WEB/EquipRequestController.See").middleware(['jwt', 'vld:0,1']); //retorna endereços, máquinas, configurações
Route.get("/equip/requests/default/:id", "WEB/EquipRequestController.SearchDefaultConfig").middleware(['jwt', 'vld:0,1']); //busca as configurações padrão da máquina
Route.get("/equip/requests/retrive/:osid", "WEB/EquipRequestController.RetriveOS").middleware(['jwt', 'vld:0,1']); //retorna o PDF da OS
Route.get("/equip/payment/card/information", "WEB/EquipRequestController.GetCardInformation").middleware(['jwt', 'vld:0,1']); //retorna informações do sistema de pagamento cartão
Route.post("/equip/requests", "WEB/EquipRequestController.Store").middleware(['jwt', 'vld:0,1']); //Solicita maquina

//Administração das Solicitações de Equipamento
Route.get("/equip/requests/all", "WEB/EquipRequestController.All").middleware(['jwt', 'vld:1,1']); //retorna todas as requisições
Route.put("/equip/requests/check", "WEB/EquipRequestController.ViewCheck").middleware(['jwt', 'vld:1,1']); //atualiza a data de visualização
Route.put("/equip/requests/validate", "WEB/EquipRequestController.ValidateOS").middleware(['jwt', 'vld:0,1']); //atualiza a configuração da maquina
Route.put("/equip/requests/inform", "WEB/EquipRequestController.TecInfEqData").middleware(['jwt', 'vld:1,0']); //atualiza a configuração da maquina
Route.put("/equip/requests/admin", "WEB/EquipRequestController.SistemOptions").middleware(['jwt', 'vld:4,0']); //adm gerencia a os

//Franquia
Route.get("/administrar/franquia", "ADMIN/FranquiasController.Show").middleware(['jwt', 'vld:1,1']);
Route.post("/administrar/franquia", "ADMIN/FranquiasController.Store").middleware(['jwt', 'vld:1,1']);

//Formulário de futuros franqueados
Route.get("/form/original", "ADMIN/FuturoFranqueadoController.RetriveWORDFORM"); //baixa o formulario .doc
Route.post("/form/solicitacao", "ADMIN/FuturoFranqueadoController.RequestCod"); //solicita código de acesso
Route.get("/form/check/:cod", "ADMIN/FuturoFranqueadoController.FutureCod"); //checa se o número do futuro franqueado existe no DB
Route.post("/form/upload/form/:CodCandidato", "ADMIN/FuturoFranqueadoController.UpdateForm"); //faz upload do formulario
Route.post("/form/upload/files", "ADMIN/FuturoFranqueadoController.FileUpload"); //faz upload de arquivos
Route.get("/form/all", "ADMIN/FuturoFranqueadoController.Show").middleware(['jwt', 'vld:1,1']); //retorna todos os formulários
Route.get("/form/pdf/:CodCandidato", "ADMIN/FuturoFranqueadoController.GeneratePDF").middleware(['jwt', 'vld:1,1']); //retorna pdf do formulario
Route.get("/form/zip/:CodCandidato", "ADMIN/FuturoFranqueadoController.GenerateZip").middleware(['jwt', 'vld:1,1']); //retorna zip dos arquivos do formulário

//Dashboard
Route.get("/dashboard/filiais", "WEB/GeneralController.Filiais").middleware(['jwt', 'vld:1,1']); //retorna pdf do formulario
Route.get("/dashboard/news", "WEB/GeneralController.ShowNews").middleware(['jwt', 'vld:0,1']); //retorna noticias
Route.post("/dashboard/news/", "WEB/GeneralController.StoreNews").middleware(['jwt', 'vld:1,1']); //guarda nova noticia
Route.post("/dashboard/news/check", "WEB/GeneralController.CheckNews").middleware(['jwt', 'vld:0,1']); //da um check que a noticia foi vizualizada
Route.delete("/dashboard/news/:id", "WEB/GeneralController.DestroyNews").middleware(['jwt', 'vld:1,1']); //inativa uma noticia
Route.get("/dashboard/block/info", "WEB/GeneralController.CheckPendencias").middleware(['jwt', 'vld:0,1']); //verifica pendencias da filial

//Monitor
Route.get("/monitor/telemetrias", "WEB/MonitorController.Telemetrias").middleware(['jwt', 'vld:0,1']); //Exibe ativos
Route.post("/monitor/telemetrias/chamado", "WEB/MonitorController.AbrirChamado").middleware(['jwt', 'vld:0,1']); //Abrir chamado
Route.put("/monitor/telemetrias/chamado", "WEB/MonitorController.FecharChamado").middleware(['jwt', 'vld:0,1']); //Fechar chamado

//Consulta Coletas
Route.get("/coletas", "WEB/ConsultaColetasController.Show").middleware(['jwt', 'vld:0,1']); //retorna todas as coletas do franqueado
Route.get("/coletas/detalhes/:anxid/:pdvid/:fseq", "WEB/ConsultaColetasController.See").middleware(['jwt', 'vld:0,1']); //retorna dados da coleta
Route.get("/coletas/detalhes/minimo/:Equicod", "WEB/ConsultaColetasController.CalcMin").middleware(['jwt', 'vld:0,1']); //retorna dados para calculo de minimo
Route.get("/coletas/historico/:equicod/:anxid", "WEB/ConsultaColetasController.NovaColetaOptions").middleware(['jwt', 'vld:0,1']); //retorna info sobre a última coleta do eq
Route.get("/coletas/novacoleta/:l1id/:l2id/:anxid/:pdvid", "WEB/ConsultaColetasController.CalcColetas").middleware(['jwt', 'vld:0,1']); //retorna qtd de doses em x tempo
Route.post("/coletas/novacoleta/", "WEB/ConsultaColetasController.GravaColeta").middleware(['jwt', 'vld:0,1']); //grava nova coleta
Route.delete("/coletas/detalhes/apagar/:EquiCod/:AnxId/:PdvId/:FfmSeq", "WEB/ConsultaColetasController.Delete").middleware(['jwt', 'vld:0,1']); //deleta coleta

//Contratos
Route.get('/contracts', "WEB/ContractController.Show").middleware(['jwt', 'vld:0,1'])
Route.post('/contracts', "WEB/ContractController.Store").middleware(['jwt', 'vld:0,1'])
Route.put('/contracts/:cnpj/:conid', "WEB/ContractController.Inativar").middleware(['jwt', 'vld:0,1'])
Route.get('/contracts/documents/:cnpj/:conid/:filename', "WEB/ContractController.Download").middleware(['jwt', 'vld:0,1'])
Route.get('/contracts/info/:tipo/:cnpj/:conid', "WEB/ContractController.See").middleware(['jwt', 'vld:0,1'])
Route.put('/contracts/info/:tipo/:cnpj/:conid', "WEB/ContractController.Update").middleware(['jwt', 'vld:0,1'])
Route.post('/contracts/upload', "WEB/ContractController.Upload").middleware(['jwt', 'vld:0,1'])

//Deposits
Route.get('/deposits', "WEB/DepositsController.Show").middleware(['jwt', 'vld:0,1'])

//Inventario
Route.get('/inventario/:depid/:ref', "WEB/InventoryController.Show").middleware(['jwt', 'vld:0,1'])
Route.put('/inventario/:depid/:ref', "WEB/InventoryController.FechaInv").middleware(['jwt', 'vld:0,1'])
Route.put('/inventario/:depid/:ref/:prodid', "WEB/InventoryController.Ajustar").middleware(['jwt', 'vld:0,1'])
Route.post('/inventario/:depid/:ref/', "WEB/InventoryController.Store").middleware(['jwt', 'vld:0,1'])

//Pontos de Venda
Route.get("/pontosdevenda", "WEB/PontosDeVendaController.Show").middleware(['jwt', 'vld:0,1']); //retorna todos os pontos de venda do franqueado
Route.get("/pontosdevenda/info/:pdvid/:anxid/:type", "WEB/PontosDeVendaController.See").middleware(['jwt', 'vld:0,1']); //retorna detalhes do ponto de venda
Route.put("/pontosdevenda/inativar", "WEB/PontosDeVendaController.InativPDV").middleware(['jwt', 'vld:0,1']); //inativa pdv
Route.put("/pontosdevenda/atualizar/:pdvid/:anxid/:type", "WEB/PontosDeVendaController.Update").middleware(['jwt', 'vld:0,1']); //atualiza dados do pdv

//Pedidos de compra
Route.get('/pedidos/compra/integracao', 'ADMIN/PedidosDeCompraController.Integrar').middleware(['jwt', 'vld:1,1']);
Route.get('/pedidos/compra/:diff', 'ADMIN/PedidosDeCompraController.Show').middleware(['jwt', 'vld:1,1']);
Route.put('/pedidos/compra/', 'ADMIN/PedidosDeCompraController.Update').middleware(['jwt', 'vld:1,1']);

//quebra galho
Route.get("/SLAPLIC/ATT", "MODS/SLaplicIntController.AttSLAPLIC"); //baixa a versão mais recente do SLAplic

//rastros
Route.post('/navegacao/', 'ADMIN/LogsController.Navegacao').middleware(['jwt', 'vld:0,0'])

//Compartilhamento
Route.get('/files/lookup/:folder', 'WEB/CompartilhamentoController.Show').middleware(['jwt', 'vld:0,1']);
Route.get('/files/download/:filepath', 'WEB/CompartilhamentoController.Download').middleware(['jwt', 'vld:0,1']);
Route.post('/files/upload/', 'WEB/CompartilhamentoController.Upload').middleware(['jwt', 'vld:1,1']);
Route.get('/files/delete/:filepath', 'WEB/CompartilhamentoController.MoveToTrash').middleware(['jwt', 'vld:1,1']);
Route.post('/files/create/folder', 'WEB/CompartilhamentoController.CreateFolder').middleware(['jwt', 'vld:1,1']);
Route.get('/files/permissions/', 'WEB/CompartilhamentoController.ShowIndexedFolders').middleware(['jwt', 'vld:4,0']);
Route.post('/files/permissions/', 'WEB/CompartilhamentoController.IndexFolder').middleware(['jwt', 'vld:4,0']);
Route.put('/files/permissions/', 'WEB/CompartilhamentoController.UpdateIndexedFolder').middleware(['jwt', 'vld:4,0']);
Route.put('/files/rename/', 'WEB/CompartilhamentoController.Rename').middleware(['jwt', 'vld:1,1']);
Route.put('/files/move/', 'WEB/CompartilhamentoController.Move').middleware(['jwt', 'vld:1,1']);

// Referencia
Route.get('/referencia', 'WEB/ReferenceController.Show').middleware(['jwt', 'vld:0,1']);

//DRE
Route.get('/dre/:ano/:mes', 'WEB/DreController.See').middleware(['jwt', 'vld:0,1']);
Route.put('/dre', 'WEB/DreController.UpdateDRE').middleware(['jwt', 'vld:0,1']);
Route.put('/dov', 'WEB/DreController.UpdateDOV').middleware(['jwt', 'vld:0,1']);
Route.get('/dre/excel/baseroy/:ano/:mes', 'WEB/DreController.GenExcelBaseRoyalties').middleware(['jwt', 'vld:0,1']);
Route.get('/dre/excel/dre/:ano/:mes', 'WEB/DreController.GenExcelDRE').middleware(['jwt', 'vld:0,1']);