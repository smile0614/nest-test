import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { Cache } from 'cache-manager';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let repo: any;
  let cache: any;

  beforeEach(async () => {
    repo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: repo },
        { provide: 'CACHE_MANAGER', useValue: cache },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an article and invalidate cache', async () => {
    repo.create.mockReturnValue({ title: 'Test', description: 'Desc', authorId: 1 });
    repo.save.mockResolvedValue({ id: 1, title: 'Test', description: 'Desc', authorId: 1 });
    cache.del.mockResolvedValue(undefined);
    const result = await service.create({ title: 'Test', description: 'Desc' }, 1);
    expect(repo.create).toHaveBeenCalledWith({ title: 'Test', description: 'Desc', authorId: 1 });
    expect(repo.save).toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith('articles');
    expect(result).toEqual({ id: 1, title: 'Test', description: 'Desc', authorId: 1 });
  });

  it('should return cached articles in findAll', async () => {
    cache.get.mockResolvedValue('cached');
    const result = await service.findAll({});
    expect(result).toBe('cached');
  });

  it('should query articles and cache result in findAll', async () => {
    cache.get.mockResolvedValue(undefined);
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    cache.set.mockResolvedValue(undefined);
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result).toEqual({ items: [{ id: 1 }], total: 1, page: 1, limit: 10 });
    expect(cache.set).toHaveBeenCalled();
  });

  it('should return cached article in findOne', async () => {
    cache.get.mockResolvedValue('cached-article');
    const result = await service.findOne(1);
    expect(result).toBe('cached-article');
  });

  it('should throw NotFoundException if article not found in findOne', async () => {
    cache.get.mockResolvedValue(undefined);
    repo.findOne.mockResolvedValue(undefined);
    await expect(service.findOne(1)).rejects.toThrow('Article not found');
  });

  it('should cache and return article in findOne', async () => {
    cache.get.mockResolvedValue(undefined);
    repo.findOne.mockResolvedValue({ id: 1 });
    cache.set.mockResolvedValue(undefined);
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1 });
    expect(cache.set).toHaveBeenCalled();
  });

  it('should update article if user is author', async () => {
    repo.findOne.mockResolvedValue({ id: 1, authorId: 2 });
    repo.save.mockResolvedValue({ id: 1, title: 'Updated', authorId: 2 });
    cache.del.mockResolvedValue(undefined);
    const result = await service.update(1, { title: 'Updated' }, 2);
    expect(result).toEqual({ id: 1, title: 'Updated', authorId: 2 });
    expect(cache.del).toHaveBeenCalledWith('article:1');
    expect(cache.del).toHaveBeenCalledWith('articles');
  });

  it('should throw ForbiddenException if user is not author in update', async () => {
    repo.findOne.mockResolvedValue({ id: 1, authorId: 2 });
    await expect(service.update(1, { title: 'Updated' }, 3)).rejects.toThrow('Not your article');
  });

  it('should throw NotFoundException if article not found in update', async () => {
    repo.findOne.mockResolvedValue(undefined);
    await expect(service.update(1, { title: 'Updated' }, 1)).rejects.toThrow('Article not found');
  });

  it('should remove article if user is author', async () => {
    repo.findOne.mockResolvedValue({ id: 1, authorId: 2 });
    repo.delete = jest.fn().mockResolvedValue(undefined);
    cache.del.mockResolvedValue(undefined);
    const result = await service.remove(1, 2);
    expect(result).toEqual({ deleted: true });
    expect(cache.del).toHaveBeenCalledWith('article:1');
    expect(cache.del).toHaveBeenCalledWith('articles');
  });

  it('should throw ForbiddenException if user is not author in remove', async () => {
    repo.findOne.mockResolvedValue({ id: 1, authorId: 2 });
    await expect(service.remove(1, 3)).rejects.toThrow('Not your article');
  });

  it('should throw NotFoundException if article not found in remove', async () => {
    repo.findOne.mockResolvedValue(undefined);
    await expect(service.remove(1, 1)).rejects.toThrow('Article not found');
  });
}); 