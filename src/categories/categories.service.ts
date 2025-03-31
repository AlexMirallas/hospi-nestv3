import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm'; // Import TreeRepository for tree entities
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService extends TypeOrmCrudService<Category> {
  // Inject TreeRepository for tree-specific methods if needed later
  constructor(@InjectRepository(Category) repo: TreeRepository<Category>) {
    super(repo);
  }

  // You can add custom methods here, e.g., findRoots, findDescendants, etc.
  // using the injected TreeRepository's methods like findTrees(), findRoots(),
  // findDescendantsTree(category), findAncestorsTree(category)
  // Example:
  // async getCategoryTree(): Promise<Category[]> {
  //   const treeRepo = this.repo as TreeRepository<Category>;
  //   return treeRepo.findTrees();
  // }
}
