import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const works = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/works'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['活动运营', '内容运营', '用户运营', '增长运营', '其他']),
    date: z.string(),
    coreData: z.string(),
    highlight: z.array(z.string()),
    htmlWork: z.string().optional(), // 嵌入HTML作品的字段
    externalLink: z.string().optional(),
  })
});

const reviews = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/reviews'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    files: z.array(z.object({
      name: z.string(), // 文件显示名称
      type: z.enum(['ppt', 'word', 'excel', 'pdf']),
      url: z.string(), // 相对 public 的路径，如 /reviews/xxx.pdf
    })),
  })
});

export const collections = { works, reviews };