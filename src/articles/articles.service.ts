import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createDto: CreateArticleDto, authorId: number) {
    const article = this.articlesRepository.create({ ...createDto, authorId });
    const saved = await this.articlesRepository.save(article);
    await this.cacheManager.del('articles'); // invalidate list cache
    return saved;
  }

  async findAll(query: { page?: number; limit?: number; authorId?: number; date?: string }) {
    const cacheKey = `articles:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
    const qb = this.articlesRepository.createQueryBuilder('article');
    if (query.authorId) qb.andWhere('article.authorId = :authorId', { authorId: query.authorId });
    if (query.date) qb.andWhere('DATE(article.publishedAt) = :date', { date: query.date });
    qb.orderBy('article.publishedAt', 'DESC');
    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    const result = { items, total, page, limit };
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  async findOne(id: number) {
    const cacheKey = `article:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.cacheManager.set(cacheKey, article, 60);
    return article;
  }

  async update(id: number, updateDto: UpdateArticleDto, userId: number) {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.authorId !== userId) throw new ForbiddenException('Not your article');
    Object.assign(article, updateDto);
    const updated = await this.articlesRepository.save(article);
    await this.cacheManager.del(`article:${id}`);
    await this.cacheManager.del('articles');
    return updated;
  }

  async remove(id: number, userId: number) {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.authorId !== userId) throw new ForbiddenException('Not your article');
    await this.articlesRepository.delete(id);
    await this.cacheManager.del(`article:${id}`);
    await this.cacheManager.del('articles');
    return { deleted: true };
  }
} 