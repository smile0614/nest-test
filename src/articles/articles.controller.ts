import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('authorId') authorId?: number, @Query('date') date?: string) {
    return this.articlesService.findAll({ page: Number(page), limit: Number(limit), authorId: authorId ? Number(authorId) : undefined, date });
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.articlesService.findOne(Number(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() dto: CreateArticleDto, @Request() req: any) {
    return this.articlesService.create(dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateArticleDto, @Request() req: any) {
    return this.articlesService.update(Number(id), dto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: any) {
    return this.articlesService.remove(Number(id), req.user.userId);
  }
} 