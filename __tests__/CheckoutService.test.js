import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

describe('CheckoutService', () => {
    const cartaoCredito = {
        numero: '4111111111111111',
        nome: 'Cliente Teste',
        validade: '12/2030',
        cvv: '123',
    };

    describe('quando o pagamento falha', () => {
        it('deve retornar null', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false }),
            };
            const repositoryDummy = {
                salvar: jest.fn(),
            };
            const emailDummy = {
                enviarEmail: jest.fn(),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryDummy,
                emailDummy
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBeNull();
        });

        it('nao deve chamar o EmailService nem o PedidoRepository', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false }),
            };
            const repositoryMock = {
                salvar: jest.fn(),
            };
            const emailMock = {
                enviarEmail: jest.fn(),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryMock,
                emailMock
            );

            // Act
            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrao finaliza a compra', () => {
        it('deve retornar o pedido salvo com o totalFinal correto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comItens([
                    new Item('Teclado', 150),
                    new Item('Mouse', 50),
                ])
                .build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation((pedido) =>
                    Promise.resolve(new Pedido(10, pedido.carrinho, pedido.totalFinal, pedido.status))
                ),
            };
            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido.id).toBe(10);
            expect(pedido.totalFinal).toBe(200);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it('deve aplicar 10% de desconto ao chamar o GatewayPagamento', async () => {
            // Arrange
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([
                    new Item('Produto A', 120),
                    new Item('Produto B', 80),
                ])
                .build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };
            const pedidoSalvo = new Pedido(20, carrinho, 180, 'PROCESSADO');
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo),
            };
            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
        });

        it('deve chamar o EmailService com os dados corretos apos pagamento bem-sucedido', async () => {
            // Arrange
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([
                    new Item('Produto A', 120),
                    new Item('Produto B', 80),
                ])
                .build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };
            const pedidoSalvo = new Pedido(20, carrinho, 180, 'PROCESSADO');
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo),
            };
            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 20 no valor de R$180'
            );
        });
    });
});
