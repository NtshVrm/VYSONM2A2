import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("url_shortener")
export class URLShortener {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  original_url!: string;

  @Column("text", { unique: true })
  short_code!: string;

  @Column("int", { default: 0 })
  visit_count!: number;

  @CreateDateColumn({ type: "timestamp" })
  last_accessed_at!: Date;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}