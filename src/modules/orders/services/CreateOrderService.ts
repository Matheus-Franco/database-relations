import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkIfCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkIfCustomerExists) {
      throw new AppError('This product was not found.');
    }

    const allProductsIds = products.map(product => {
      return {
        id: product.id,
      };
    });

    const findProducts = await this.productsRepository.findAllById(
      allProductsIds,
    );

    if (findProducts.length !== products.length) {
      throw new AppError('Some product was not found.');
    }

    const updatedQuantities: IUpdateProductsQuantityDTO[] = [];

    const totalProducts = findProducts.map(foundProduct => {
      const orderProduct = products.find(
        product => product.id === foundProduct.id,
      );

      if (orderProduct) {
        if (foundProduct.quantity < orderProduct.quantity) {
          throw new AppError('Sorry, insufficient quantity in stock');
        }

        updatedQuantities.push({
          id: orderProduct?.id,
          quantity: foundProduct.quantity - orderProduct?.quantity,
        });

        return {
          ...foundProduct,
          quantity: orderProduct.quantity,
        };
      }

      return foundProduct;
    });

    await this.productsRepository.updateQuantity(updatedQuantities);

    const order = await this.ordersRepository.create({
      customer: checkIfCustomerExists,
      products: totalProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateOrderService;
