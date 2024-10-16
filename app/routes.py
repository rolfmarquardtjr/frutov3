from flask import Blueprint, render_template, request, jsonify, current_app, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from pydantic import BaseModel
from typing import List
from app import db, client, csrf, mail
from app.models import Idea, Question, Task, Tag, SWOT, SWOTItem, SWOTAnalysis, Expense, ExpenseCategory, ChatMessage, NetworkingContact, NetworkingPost, Goal, LegalStep, LegalConsultation, MarketResearch, Customer
from datetime import datetime, timedelta
import logging
import http.client
import json
import urllib.parse
import pywhatkit
import pytz
from flask_mail import Message
from app.forms import ProfileSettingsForm
import smtplib
from email.mime.text import MIMEText
import io
import csv
from flask import send_file

main = Blueprint('main', __name__)

class QuestionModel(BaseModel):
    text: str

class QuestionList(BaseModel):
    questions: List[QuestionModel]

class IdeaTitle(BaseModel):
    title: str

class TaskModel(BaseModel):
    content: str
    criticality: int
    tags: List[str]

class TaskList(BaseModel):
    tasks: List[TaskModel]

class SWOTAnalysisModel(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]

@main.route('/')
@login_required
def index():
    ideas = Idea.query.filter_by(user_id=current_user.id).order_by(Idea.timestamp.desc()).all()
    selected_idea_id = ideas[0].id if ideas else None
    return render_template('index.html', ideas=ideas, selected_idea_id=selected_idea_id)

@main.route('/save_idea', methods=['POST'])
@login_required
def save_idea():
    description = request.json['description']
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em criar títulos concisos para ideias de negócio. Gere um título curto e atrativo baseado na descrição fornecida."},
                {"role": "user", "content": f"Descrição da ideia: {description}"}
            ],
            response_format=IdeaTitle,
        )
        
        title = completion.choices[0].message.parsed.title
    except Exception as e:
        current_app.logger.error(f"Error generating title: {str(e)}")
        title = "Nova Ideia"
    
    idea = Idea(title=title, description=description, author=current_user)
    db.session.add(idea)
    db.session.commit()
    return jsonify({'success': True, 'id': idea.id, 'title': title})

@main.route('/generate_questions', methods=['POST'])
@login_required
def generate_questions():
    data = request.json
    idea_id = data['idea_id']
    idea = Idea.query.get_or_404(idea_id)
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em empreendedorismo. Gere 5 perguntas relevantes para aprofundar o entendimento da ideia de negócio apresentada."},
                {"role": "user", "content": f"Ideia de negócio: {idea.description}"}
            ],
            response_format=QuestionList,
        )
        
        questions = completion.choices[0].message.parsed.questions
        
        for q in questions:
            question = Question(text=q.text, idea=idea)
            db.session.add(question)
        db.session.commit()
        
        return jsonify([q.text for q in questions])
    except Exception as e:
        current_app.logger.error(f"Error generating questions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route('/save_answers', methods=['POST'])
@login_required
def save_answers():
    data = request.json
    idea_id = data['idea_id']
    answers = data['answers']
    
    questions = Question.query.filter_by(idea_id=idea_id).all()
    for q, a in zip(questions, answers):
        q.answer = a
    
    db.session.commit()
    return jsonify({'success': True})

@main.route('/get_idea/<int:idea_id>')
@login_required
def get_idea(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    questions = Question.query.filter_by(idea_id=idea_id).all()
    return jsonify({
        'id': idea.id,
        'title': idea.title,
        'description': idea.description,
        'questions': [{'text': q.text, 'answer': q.answer} for q in questions]
    })

@main.route('/generate_tasks', methods=['POST'])
@login_required
def generate_tasks():
    data = request.json
    idea_id = data['idea_id']
    idea = Idea.query.get_or_404(idea_id)
    questions = Question.query.filter_by(idea_id=idea_id).all()
    
    context = f"Ideia: {idea.description}\n"
    for q in questions:
        context += f"Pergunta: {q.text}\nResposta: {q.answer}\n"
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em planejamento de projetos. Gere 10 tarefas iniciais para tirar a ideia do papel, baseando-se na descrição da ideia e nas perguntas e respostas fornecidas. Para cada tarefa, inclua um nível de criticidade (0 para baixa, 1 para média, 2 para alta) e até 3 tags relevantes."},
                {"role": "user", "content": context}
            ],
            response_format=TaskList,
        )
        
        tasks = completion.choices[0].message.parsed.tasks
        
        for i, task in enumerate(tasks):
            new_task = Task(
                content=task.content,
                status='to_do',
                order=i,
                idea=idea,
                criticality=task.criticality
            )
            db.session.add(new_task)
            
            # Adicionar tags
            for tag_name in task.tags:
                tag = Tag.query.filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name)
                    db.session.add(tag)
                new_task.tags.append(tag)
        
        db.session.commit()
        
        return jsonify({'success': True, 'tasks': [{'id': t.id, 'content': t.content, 'status': t.status, 'criticality': t.criticality, 'tags': [{'id': tag.id, 'name': tag.name} for tag in t.tags]} for t in idea.tasks]})
    except Exception as e:
        current_app.logger.error(f"Error generating tasks: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route('/kanban')
@login_required
def kanban_overview():
    ideas = Idea.query.filter_by(user_id=current_user.id).all()
    if ideas:
        return redirect(url_for('main.kanban', idea_id=ideas[0].id))
    return render_template('kanban_overview.html', ideas=ideas)

@main.route('/kanban/<int:idea_id>')
@login_required
def kanban(idea_id):
    return view_idea(idea_id, 'kanban')

@main.route('/get_tasks/<int:idea_id>')
@login_required
def get_tasks(idea_id):
    tasks = Task.query.filter_by(idea_id=idea_id).order_by(Task.order).all()
    return jsonify([{
        'id': task.id,
        'content': task.content,
        'status': task.status,
        'order': task.order,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'criticality': task.criticality,
        'tags': [{'id': tag.id, 'name': tag.name} for tag in task.tags]
    } for task in tasks])

@main.route('/add_task', methods=['POST'])
@login_required
def add_task():
    data = request.json
    current_app.logger.info(f"Received task data: {data}")
    new_task = Task(
        content=data['content'],
        status=data['status'],
        order=data.get('order', 0),
        idea_id=data['idea_id'],
        due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
        criticality=data.get('criticality', 0)
    )
    db.session.add(new_task)

    # Add tags
    for tag_name in data.get('tags', []):
        tag = Tag.query.filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.session.add(tag)
        new_task.tags.append(tag)

    db.session.commit()
    return jsonify({
        'id': new_task.id,
        'content': new_task.content,
        'status': new_task.status,
        'order': new_task.order,
        'due_date': new_task.due_date.isoformat() if new_task.due_date else None,
        'criticality': new_task.criticality,
        'tags': [{'id': tag.id, 'name': tag.name} for tag in new_task.tags]
    })

@main.route('/update_task', methods=['POST'])
@login_required
@csrf.exempt  # Se necessário para requisiões AJAX
def update_task():
    data = request.json
    current_app.logger.info(f"Dados recebidos na atualização da tarefa: {data}")
    
    if 'task_id' not in data:
        current_app.logger.error("task_id não fornecido")
        return jsonify({"success": False, "error": "task_id é obrigatório"}), 400
    
    task = Task.query.get_or_404(data['task_id'])
    
    try:
        task.content = data.get('content', task.content)
        task.status = data.get('status', task.status)
        task.due_date = datetime.fromisoformat(data['due_date']) if data.get('due_date') else None
        task.criticality = data.get('criticality', task.criticality)

        # Atualizar tags
        task.tags = []
        for tag_name in data.get('tags', []):
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
            task.tags.append(tag)

        db.session.commit()
        
        return jsonify({
            'success': True,
            'id': task.id,
            'content': task.content,
            'status': task.status,
            'order': task.order,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'criticality': task.criticality,
            'tags': [{'id': tag.id, 'name': tag.name} for tag in task.tags]
        })
    except Exception as e:
        current_app.logger.error(f"Erro ao atualizar tarefa: {str(e)}")
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 400

@main.route('/delete_task', methods=['POST'])
@login_required
def delete_task():
    task_id = request.json['task_id']
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'success': True})

@main.route('/add_tag', methods=['POST'])
@login_required
def add_tag():
    task_id = request.json['task_id']
    tag_name = request.json['tag_name']
    
    task = Task.query.get_or_404(task_id)
    tag = Tag.query.filter_by(name=tag_name).first()
    if not tag:
        tag = Tag(name=tag_name)
        db.session.add(tag)
    
    task.tags.append(tag)
    db.session.commit()
    return jsonify({'success': True, 'tag_id': tag.id})

@main.route('/remove_tag', methods=['POST'])
@login_required
def remove_tag():
    task_id = request.json['task_id']
    tag_id = request.json['tag_id']
    
    task = Task.query.get_or_404(task_id)
    tag = Tag.query.get_or_404(tag_id)
    
    task.tags.remove(tag)
    db.session.commit()
    return jsonify({'success': True})

@main.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@main.route('/swot_overview')
@login_required
def swot_overview():
    ideas = Idea.query.filter_by(user_id=current_user.id).all()
    if ideas:
        return redirect(url_for('main.swot_analysis', idea_id=ideas[0].id))
    return render_template('swot_overview.html', ideas=ideas)

@main.route('/swot/<int:idea_id>')
@login_required
def swot_analysis(idea_id):
    return view_idea(idea_id, 'swot')

@main.route('/generate_swot/<int:idea_id>')
@login_required
def generate_swot(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    swot = generate_swot_analysis(idea)
    return redirect(url_for('main.swot_analysis', idea_id=idea_id))

@main.route('/add_swot_item', methods=['POST'])
@login_required
def add_swot_item():
    data = request.json
    swot_id = data['swot_id']
    category = data['category']
    content = data['content']
    
    swot_item = SWOTItem(swot_id=swot_id, category=category, content=content)
    db.session.add(swot_item)
    db.session.commit()
    
    return jsonify({'success': True, 'id': swot_item.id})

@main.route('/remove_swot_item', methods=['POST'])
@login_required
def remove_swot_item():
    data = request.json
    item_id = data['item_id']
    
    swot_item = SWOTItem.query.get_or_404(item_id)
    db.session.delete(swot_item)
    db.session.commit()
    
    return jsonify({'success': True})

def generate_swot_analysis(idea):
    questions = Question.query.filter_by(idea_id=idea.id).all()
    
    context = f"Ideia: {idea.description}\n"
    for q in questions:
        context += f"Pergunta: {q.text}\nResposta: {q.answer}\n"
    
    swot = SWOT.query.filter_by(idea_id=idea.id).first()
    if not swot:
        swot = SWOT(idea_id=idea.id)
        db.session.add(swot)
    else:
        # Limpar itens SWOT existentes
        SWOTItem.query.filter_by(swot_id=swot.id).delete()
    
    db.session.commit()
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um especialista em análise de negócios. Com base na ideia e nas perguntas e respostas fornecidas, gere uma análise SWOT (Forças, Fraquezas, Oportunidades e Ameaças) para o negócio proposto."},
                {"role": "user", "content": context}
            ],
            response_format=SWOTAnalysisModel,
        )
        
        swot_data = completion.choices[0].message.parsed
        
        for strength in swot_data.strengths:
            item = SWOTItem(swot_id=swot.id, category='strength', content=strength)
            db.session.add(item)
        
        for weakness in swot_data.weaknesses:
            item = SWOTItem(swot_id=swot.id, category='weakness', content=weakness)
            db.session.add(item)
        
        for opportunity in swot_data.opportunities:
            item = SWOTItem(swot_id=swot.id, category='opportunity', content=opportunity)
            db.session.add(item)
        
        for threat in swot_data.threats:
            item = SWOTItem(swot_id=swot.id, category='threat', content=threat)
            db.session.add(item)
        
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"Error generating SWOT analysis: {str(e)}")
        db.session.rollback()
    
    return swot

@main.route('/assistant/<int:idea_id>')
@login_required
def assistant(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    chat_messages = ChatMessage.query.filter_by(idea_id=idea_id).order_by(ChatMessage.timestamp).all()
    return render_template('assistant.html', idea=idea, chat_messages=chat_messages)

@main.route('/api/assistant/<int:idea_id>/chat', methods=['POST'])
@login_required
@csrf.exempt
def chat_with_assistant(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    if not data or 'message' not in data:
        return jsonify({"success": False, "error": "Mensagem não fornecida"}), 400

    user_message = data['message']

    # Salvar a mensagem do usuário
    user_chat_message = ChatMessage(idea_id=idea_id, role='user', content=user_message)
    db.session.add(user_chat_message)
    db.session.commit()

    # Preparar o contexto para o assistente
    context = prepare_assistant_context(idea)

    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": context},
                {"role": "user", "content": user_message}
            ]
        )
        
        assistant_response = completion.choices[0].message.content

        # Salvar a resposta do assistente
        assistant_chat_message = ChatMessage(idea_id=idea_id, role='assistant', content=assistant_response)
        db.session.add(assistant_chat_message)
        db.session.commit()

        return jsonify({'success': True, 'response': assistant_response})
    except Exception as e:
        current_app.logger.error(f"Error in chat with assistant: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

def prepare_assistant_context(idea):
    context = f"Você é um assistente IA especializado em ajudar com a seguinte ideia de negócio: {idea.description}\n\n"
    
    # Adicionar informações sobre gastos
    expenses = Expense.query.filter_by(idea_id=idea.id).all()
    if expenses:
        context += "Gastos registrados:\n"
        for expense in expenses:
            context += f"- {expense.description}: R${expense.amount} ({expense.date.strftime('%d/%m/%Y')})\n"
    
    # Adicionar informações sobre tarefas do Kanban
    tasks = Task.query.filter_by(idea_id=idea.id).all()
    if tasks:
        context += "\nTarefas do Kanban:\n"
        for task in tasks:
            context += f"- {task.content} (Status: {task.status})\n"
    
    # Adicionar perguntas e respostas
    questions = Question.query.filter_by(idea_id=idea.id).all()
    if questions:
        context += "\nPerguntas e respostas sobre a ideia:\n"
        for question in questions:
            context += f"Q: {question.text}\n"
            context += f"A: {question.answer}\n\n"
    
    context += "\nCom base nessas informações, ajude o usuário com suas dúvidas e forneça insights relevantes para o desenvolvimento do negócio."
    
    return context

@main.route('/expenses/<int:idea_id>')
@login_required
def view_expenses(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    expenses = Expense.query.filter_by(idea_id=idea_id).all()
    categories = ExpenseCategory.query.all()
    return render_template('expenses.html', idea=idea, expenses=expenses, categories=categories)

@main.route('/goals/<int:idea_id>')
@login_required
def goals(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    goals = Goal.query.filter_by(idea_id=idea_id).order_by(Goal.created_at.desc()).all()
    return render_template('goals.html', idea=idea, goals=goals)

@main.route('/api/goals/<int:idea_id>', methods=['GET', 'POST'])
@login_required
def api_goals(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    if request.method == 'POST':
        data = request.json
        new_goal = Goal(
            idea_id=idea_id,
            title=data['title'],
            description=data['description'],
            deadline=datetime.strptime(data['deadline'], '%Y-%m-%d').date() if data['deadline'] else None,
            status=data['status'],
            category=data['category']
        )
        db.session.add(new_goal)
        db.session.commit()
        return jsonify({'success': True, 'id': new_goal.id}), 201

    goals = Goal.query.filter_by(idea_id=idea_id).all()
    return jsonify([{
        'id': g.id,
        'title': g.title,
        'description': g.description,
        'deadline': g.deadline.isoformat() if g.deadline else None,
        'status': g.status,
        'category': g.category,
        'progress': g.progress
    } for g in goals])

@main.route('/api/goals/<int:goal_id>', methods=['PUT', 'DELETE'])
@login_required
def api_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    if goal.idea.user_id != current_user.id:
        abort(403)

    if request.method == 'PUT':
        data = request.json
        goal.title = data.get('title', goal.title)
        goal.description = data.get('description', goal.description)
        goal.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date() if data.get('deadline') else None
        goal.status = data.get('status', goal.status)
        goal.category = data.get('category', goal.category)
        goal.progress = data.get('progress', goal.progress)
        db.session.commit()
        return jsonify({'success': True})

    elif request.method == 'DELETE':
        db.session.delete(goal)
        db.session.commit()
        return jsonify({'success': True})

@main.route('/api/goals/<int:idea_id>/generate', methods=['POST'])
@login_required
def generate_goals(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    timeframe = data.get('timeframe', 'trimestral')
    aggression = int(data.get('aggression', 3))
    budget = float(data.get('budget', 0))
    context = data.get('context', '')

    context_text = f"Ideia de negócio: {idea.description}\n\n"
    questions = Question.query.filter_by(idea_id=idea.id).all()
    for question in questions:
        context_text += f"Q: {question.text}\nA: {question.answer}\n\n"
    context_text += f"Período: {timeframe}\n"
    context_text += f"Nível de agressividade: {aggression}/5\n"
    context_text += f"Orçamento: R$ {budget}\n"
    context_text += f"Contexto adicional: {context}\n"

    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"Você é um especialista em planejamento estratégico. Com base nas informações fornecidas sobre a ideia de negócio, sugira 5 metas SMART (Específicas, Mensuráveis, Alcançáveis, Relevantes e Temporais) para o período de {timeframe} com um nível de agressividade de {aggression}/5 e um orçamento de R$ {budget}. Forneça uma meta para cada categoria: Específica, Mensurável, Alcançável, Relevante e Temporal. Separe cada meta com um caractere de nova linha."},
                {"role": "user", "content": context_text}
            ]
        )
        
        generated_goals = completion.choices[0].message.content.split('\n')
        generated_goals = [goal.strip() for goal in generated_goals if goal.strip()]  # Remove linhas vazias
        
        categories = ['especifica', 'mensuravel', 'alcancavel', 'relevante', 'temporal']
        for i, goal in enumerate(generated_goals):
            if i < len(categories):
                new_goal = Goal(
                    idea_id=idea_id,
                    title=goal,
                    description="Meta gerada automaticamente",
                    deadline=(datetime.now() + timedelta(days=180)).date(),
                    status="Em andamento",
                    category=categories[i],
                    timeframe=timeframe,
                    aggression=aggression
                )
                db.session.add(new_goal)
        
        db.session.commit()
        return jsonify({"success": True, "message": f"Metas geradas com sucesso para o período {timeframe} com agressividade {aggression}/5."})

    except Exception as e:
        current_app.logger.error(f"Error in goal generation: {str(e)}")
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/market_research/<int:idea_id>')
@login_required
def market_research(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    researches = MarketResearch.query.filter_by(idea_id=idea_id).order_by(MarketResearch.created_at.desc()).all()
    return render_template('market_research.html', idea=idea, researches=researches)

@main.route('/api/market_research/<int:idea_id>/generate', methods=['POST'])
@login_required
def generate_market_research(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    location = data.get('location', '')
    options = data.get('options', [])

    context = f"Ideia de negócio: {idea.description}\n\n"
    questions = Question.query.filter_by(idea_id=idea.id).all()
    for question in questions:
        context += f"Q: {question.text}\nA: {question.answer}\n\n"

    prompt = f"""Você é um especialista em pesquisa de mercado. Com base nas informações fornecidas sobre a ideia de negócio, realize uma pesquisa de mercado abrangente. Use a internet para encontrar informações atualizadas e relevantes. Inclua links acessíveis para as fontes de informação.

Ideia: {context}

Localização: {location}

Opções de pesquisa selecionadas: {', '.join(options)}

Forneça uma análise detalhada que inclua:
1. Tamanho e crescimento do mercado
2. Principais concorrentes e suas estratégias
3. Tendências do setor
4. Perfil do público-alvo
5. Regulamentações relevantes
6. Oportunidades e desafios potenciais

Certifique-se de incluir links para todas as fontes de informação utilizadas."""

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um assistente de pesquisa de mercado especializado."},
                {"role": "user", "content": prompt}
            ]
        )
        
        research_content = completion.choices[0].message.content

        new_research = MarketResearch(idea_id=idea_id, content=research_content, location=location)
        db.session.add(new_research)
        db.session.commit()

        return jsonify({"success": True, "content": research_content})

    except Exception as e:
        current_app.logger.error(f"Error in market research generation: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/api/market_research/<int:research_id>', methods=['DELETE'])
@login_required
def delete_market_research(research_id):
    research = MarketResearch.query.get_or_404(research_id)
    if research.idea.user_id != current_user.id:
        abort(403)

    db.session.delete(research)
    db.session.commit()
    return jsonify({'success': True})

@main.route('/legal/<int:idea_id>')
@login_required
def legal(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    legal_steps = LegalStep.query.filter_by(idea_id=idea_id).order_by(LegalStep.order).all()
    consultations = LegalConsultation.query.filter_by(idea_id=idea_id).order_by(LegalConsultation.created_at).all()
    return render_template('legal.html', idea=idea, legal_steps=legal_steps, consultations=consultations)



@main.route('/generate_more_tasks', methods=['POST'])
@login_required
def generate_more_tasks():
    idea_id = request.json['idea_id']
    idea = Idea.query.get_or_404(idea_id)
    completed_tasks = Task.query.filter_by(idea_id=idea_id, status='closed').all()
    
    context = f"Ideia: {idea.description}\n"
    context += "Tarefas concluídas:\n"
    for task in completed_tasks:
        context += f"- {task.content}\n"
    
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em planejamento de projetos. Gere 5 novas tarefas para continuar o desenvolvimento da ideia, considerando as tarefas já concluídas."},
                {"role": "user", "content": context}
            ],
            response_format=TaskList,
        )
        
        tasks = completion.choices[0].message.parsed.tasks
        
        for i, task in enumerate(tasks):
            new_task = Task(content=task.content, status='to_do', order=i, idea=idea)
            db.session.add(new_task)
        
        db.session.commit()
        
        return jsonify({'success': True, 'tasks': [{'id': t.id, 'content': t.content, 'status': t.status} for t in idea.tasks.filter_by(status='to_do')]})
    except Exception as e:
        current_app.logger.error(f"Error generating more tasks: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route('/analyze_swot', methods=['POST'])
@login_required
def analyze_swot():
    data = request.json
    swot_id = data['swot_id']
    swot = SWOT.query.get_or_404(swot_id)
    
    # Preparar o contexto para a IA
    context = "Análise SWOT:\n"
    for category in ['strength', 'weakness', 'opportunity', 'threat']:
        items = SWOTItem.query.filter_by(swot_id=swot.id, category=category).all()
        context += f"{category.capitalize()}s:\n"
        for item in items:
            context += f"- {item.content}\n"
    
    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Você é um especialista em análise de negócios. Com base na análise SWOT fornecida, faça uma análise concisa e forneça insights estratégicos em no máximo 150 palavras."},
                {"role": "user", "content": context}
            ]
        )
        
        analysis = completion.choices[0].message.content
        timestamp = datetime.now()

        # Salvar a análise no banco de dados
        new_analysis = SWOTAnalysis(swot_id=swot.id, content=analysis, timestamp=timestamp)
        db.session.add(new_analysis)
        db.session.commit()

        return jsonify({'success': True, 'analysis': analysis, 'timestamp': timestamp.strftime("%d/%m/%Y %H:%M:%S")})
    except Exception as e:
        current_app.logger.error(f"Error analyzing SWOT: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/update_swot_item', methods=['POST'])
@login_required
@csrf.exempt
def update_swot_item():
    data = request.json
    item_id = data.get('item_id')
    new_content = data.get('content')
    new_category = data.get('category')
    
    swot_item = SWOTItem.query.get_or_404(item_id)
    
    # Verifique se o usuário tem permissão para editar este item
    if swot_item.swot.idea.user_id != current_user.id:
        return jsonify({"success": False, "error": "Não autorizado"}), 403
    
    swot_item.content = new_content
    swot_item.category = new_category
    db.session.commit()
    
    return jsonify({'success': True})

@main.route('/update_swot_item_category', methods=['POST'])
@login_required
@csrf.exempt
def update_swot_item_category():
    data = request.json
    item_id = data.get('item_id')
    new_category = data.get('category')
    
    swot_item = SWOTItem.query.get_or_404(item_id)
    
    # Verifique se o usuário tem permissão para editar este item
    if swot_item.swot.idea.user_id != current_user.id:
        return jsonify({"success": False, "error": "Não autorizado"}), 403
    
    swot_item.category = new_category
    db.session.commit()
    
    return jsonify({'success': True})

@main.route('/idea/<int:idea_id>/<string:view>')
@login_required
def view_idea(idea_id, view):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    
    tasks = Task.query.filter_by(idea_id=idea_id).order_by(Task.order).all()
    swot = SWOT.query.filter_by(idea_id=idea_id).first()
    if not swot:
        swot = SWOT(idea_id=idea_id)
        db.session.add(swot)
        db.session.commit()
    
    analyses = SWOTAnalysis.query.filter_by(swot_id=swot.id).order_by(SWOTAnalysis.timestamp.desc()).all()
    
    return render_template('view_idea.html', idea=idea, tasks=tasks, swot=swot, analyses=analyses, view=view, selected_idea_id=idea_id)

@main.context_processor
def inject_user_ideas():
    if current_user.is_authenticated:
        user_ideas = current_user.ideas.all()
        selected_idea_id = request.view_args.get('idea_id')
        return {'user_ideas': user_ideas, 'selected_idea_id': selected_idea_id}
    return {}

@main.route('/delete_idea/<int:idea_id>', methods=['POST'])
@login_required
def delete_idea(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403
    
    try:
        # Excluir tarefas relacionadas
        Task.query.filter_by(idea_id=idea.id).delete()
        
        # Excluir análise SWOT relacionada
        swot = SWOT.query.filter_by(idea_id=idea.id).first()
        if swot:
            SWOTItem.query.filter_by(swot_id=swot.id).delete()
            SWOTAnalysis.query.filter_by(swot_id=swot.id).delete()
            db.session.delete(swot)
        
        # Excluir perguntas relacionadas
        Question.query.filter_by(idea_id=idea.id).delete()
        
        # Finalmente, excluir a ideia
        db.session.delete(idea)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/api/expenses/<int:idea_id>', methods=['GET', 'POST'])
@login_required
@csrf.exempt
def api_expenses(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    if request.method == 'POST':
        try:
            data = request.json
            category = ExpenseCategory.query.get(data['category'])
            if not category:
                return jsonify({"error": "Categoria não encontrada"}), 400
            
            new_expense = Expense(
                idea_id=idea_id,
                description=data['description'],
                amount=data['amount'],
                date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
                category=category
            )
            db.session.add(new_expense)

            # Adicionar tags
            tags = data.get('tags', [])
            for tag_name in tags:
                tag = Tag.query.filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name)
                    db.session.add(tag)
                new_expense.tags.append(tag)
            
            db.session.commit()
            return jsonify({"success": True, "id": new_expense.id}), 201
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Erro ao adicionar despesa: {str(e)}")
            return jsonify({"error": "Erro ao adicionar despesa"}), 500

    try:
        expenses = Expense.query.filter_by(idea_id=idea_id).all()
        return jsonify([{
            'id': e.id,
            'description': e.description,
            'amount': e.amount,
            'date': e.date.isoformat(),
            'category': e.category.name,
            'tags': [tag.name for tag in e.tags]
        } for e in expenses])
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar despesas: {str(e)}")
        return jsonify({"error": "Erro ao buscar despesas"}), 500

@main.route('/api/expenses/<int:expense_id>', methods=['GET', 'DELETE'])
@login_required
@csrf.exempt
def api_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    if expense.idea.user_id != current_user.id:
        return jsonify({"error": "Não autorizado"}), 403

    if request.method == 'GET':
        try:
            data = {
                'id': expense.id,
                'description': expense.description,
                'amount': expense.amount,
                'date': expense.date.isoformat() if expense.date else None,
                'category': expense.category_id,
                'tags': [tag.name for tag in expense.tags]
            }
            return jsonify(data)
        except Exception as e:
            current_app.logger.error(f"Erro ao buscar despesa {expense_id}: {str(e)}")
            return jsonify({"error": "Erro ao buscar despesa"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(expense)
            db.session.commit()
            return jsonify(success=True)
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Erro ao excluir despesa: {str(e)}")
            return jsonify({"error": "Erro ao excluir despesa"}), 500

@main.route('/api/categories', methods=['GET', 'POST'])
@login_required
@csrf.exempt
def api_categories():
    if request.method == 'POST':
        data = request.json
        new_category = ExpenseCategory(name=data['name'])
        db.session.add(new_category)
        db.session.commit()
        return jsonify({'success': True, 'id': new_category.id, 'name': new_category.name})
    
    categories = ExpenseCategory.query.all()
    return jsonify([{'id': c.id, 'name': c.name} for c in categories])

@main.route('/api/expenses/<int:idea_id>/analyze', methods=['POST'])
@login_required
@csrf.exempt
def analyze_expenses(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    expenses = Expense.query.filter_by(idea_id=idea_id).all()
    expense_data = [{
        'description': e.description,
        'amount': e.amount,
        'date': e.date.isoformat(),
        'category': e.category.name
    } for e in expenses]

    # Aqui você chamaria a API da OpenAI para análise
    # Por enquanto, vamos retornar uma análise fictícia
    analysis = "Análise de gastos fictícia. Implemente a chamada à API da OpenAI aqui."

    return jsonify(analysis=analysis)

@main.route('/debug/expenses')
@login_required
def debug_expenses():
    expenses = Expense.query.all()
    return jsonify([{
        'id': e.id,
        'description': e.description,
        'amount': e.amount,
        'date': e.date.isoformat(),
        'category': e.category.name,
        'tags': [tag.name for tag in e.tags]
    } for e in expenses])

@main.route('/networking/<int:idea_id>')
@login_required
def networking(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    contacts = NetworkingContact.query.filter_by(idea_id=idea_id).all()
    return render_template('networking.html', idea=idea, contacts=contacts)

@main.route('/api/networking/<int:idea_id>/search', methods=['POST'])
@login_required
def search_networking(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    # Preparar o contexto para a OpenAI
    context = prepare_networking_context(idea)

    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em networking. Com base nas informações fornecidas sobre a ideia de negócio, sugira até três palavras-chave ou frases curtas relevantes para buscar posts no LinkedIn. Separe as palavras-chave por vírgulas."},
                {"role": "user", "content": context}
            ]
        )
        
        keywords = [k.strip() for k in completion.choices[0].message.content.split(',')]
        
        current_app.logger.info(f"Keywords geradas: {keywords}")

        conn = http.client.HTTPSConnection("linkedin-data-api.p.rapidapi.com")

        payload = json.dumps({
            "keyword": keywords[0],  # Usando apenas a primeira keyword para aumentar as chances de resultados
            "sortBy": "date_posted",
            "datePosted": "",
            "page": 1,
            "contentType": "",
            "fromMember": [],
            "fromCompany": [],
            "mentionsMember": [],
            "mentionsOrganization": [],
            "authorIndustry": [],
            "authorCompany": [],
            "authorTitle": ""
        })

        headers = {
            'x-rapidapi-key': current_app.config['RAPIDAPI_KEY'],
            'x-rapidapi-host': "linkedin-data-api.p.rapidapi.com",
            'Content-Type': "application/json"
        }

        conn.request("POST", "/search-posts", payload, headers)

        res = conn.getresponse()
        data = json.loads(res.read().decode("utf-8"))

        current_app.logger.info(f"Resposta da API: {data}")

        if data.get('success') and 'data' in data:
            if data['data'].get('items'):
                return jsonify({"success": True, "data": data['data']['items']})
            else:
                return jsonify({"success": True, "data": [], "message": "Nenhum resultado encontrado para as palavras-chave geradas."})
        else:
            error_message = "Resposta inesperada da API do LinkedIn"
            current_app.logger.error(f"{error_message}: {data}")
            return jsonify({"success": False, "error": error_message}), 400

    except Exception as e:
        current_app.logger.error(f"Error in networking search: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    
@main.route('/api/networking/<int:idea_id>/save', methods=['POST'])
@login_required
def save_networking_contact(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    new_contact = NetworkingContact(
        idea_id=idea_id,
        name=data['name'],
        title=data.get('title'),
        company=data.get('company'),
        linkedin_url=data.get('linkedin_url'),
        notes=data.get('notes')
    )
    db.session.add(new_contact)
    db.session.commit()

    return jsonify({"success": True, "id": new_contact.id})

def prepare_networking_context(idea):
    context = f"Ideia de negócio: {idea.description}\n\n"
    questions = Question.query.filter_by(idea_id=idea.id).all()
    for question in questions:
        context += f"Q: {question.text}\nA: {question.answer}\n\n"
    return context

@main.route('/api/networking/<int:idea_id>/manual_search', methods=['POST'])
@login_required
def manual_search_networking(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    keywords = request.json.get('keywords', '')
    keywords = [k.strip() for k in keywords.split(',') if k.strip()]

    if not keywords:
        return jsonify({"success": False, "error": "Nenhuma palavra-chave fornecida"}), 400

    try:
        conn = http.client.HTTPSConnection("linkedin-data-api.p.rapidapi.com")

        payload = json.dumps({
            "keyword": " ".join(keywords),
            "sortBy": "date_posted",
            "datePosted": "",
            "page": 1,
            "contentType": "",
            "fromMember": [],
            "fromCompany": [],
            "mentionsMember": [],
            "mentionsOrganization": [],
            "authorIndustry": [],
            "authorCompany": [],
            "authorTitle": ""
        })

        headers = {
            'x-rapidapi-key': current_app.config['RAPIDAPI_KEY'],
            'x-rapidapi-host': "linkedin-data-api.p.rapidapi.com",
            'Content-Type': "application/json"
        }

        conn.request("POST", "/search-posts", payload, headers)

        res = conn.getresponse()
        data = json.loads(res.read().decode("utf-8"))

        current_app.logger.info(f"Resposta da API: {data}")

        if data.get('success') and 'data' in data and 'items' in data['data']:
            return jsonify({"success": True, "data": data['data']['items']})
        else:
            error_message = "Resposta inesperada da API do LinkedIn"
            current_app.logger.error(f"{error_message}: {data}")
            return jsonify({"success": False, "error": error_message}), 400

    except Exception as e:
        current_app.logger.error(f"Error in manual networking search: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/api/networking/<int:idea_id>/save_post', methods=['POST'])
@login_required
def save_networking_post(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    new_post = NetworkingPost(
        idea_id=idea_id,
        author_name=data.get('author', {}).get('fullName', 'Autor Desconhecido'),
        content=data.get('text', 'Conteúdo não disponível'),
        linkedin_url=data.get('url', ''),
        likes_count=data.get('socialActivityCountsInsight', {}).get('likeCount', 0),
        comments_count=data.get('socialActivityCountsInsight', {}).get('numComments', 0)
    )
    db.session.add(new_post)
    db.session.commit()

    return jsonify({"success": True, "id": new_post.id})

@main.route('/api/networking/<int:idea_id>/saved_posts', methods=['GET'])
@login_required
def get_saved_posts(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    
    saved_posts = NetworkingPost.query.filter_by(idea_id=idea_id).order_by(NetworkingPost.created_at.desc()).all()
    posts_data = [{
        'id': post.id,
        'author_name': post.author_name,
        'content': post.content,
        'linkedin_url': post.linkedin_url,
        'likes_count': post.likes_count,
        'comments_count': post.comments_count,
        'created_at': post.created_at.isoformat()
    } for post in saved_posts]
    
    return jsonify({"success": True, "data": posts_data})

@main.route('/api/networking/<int:idea_id>/delete_post/<int:post_id>', methods=['DELETE'])
@login_required
def delete_networking_post(idea_id, post_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    
    post = NetworkingPost.query.get_or_404(post_id)
    if post.idea_id != idea_id:
        abort(404)
    
    db.session.delete(post)
    db.session.commit()
    
    return jsonify({"success": True})


@main.route('/api/legal/<int:idea_id>/generate', methods=['POST'])
@login_required
def generate_legal_steps(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    context = f"Ideia de negócio: {idea.description}\n\n"
    questions = Question.query.filter_by(idea_id=idea.id).all()
    for question in questions:
        context += f"Q: {question.text}\nA: {question.answer}\n\n"

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um consultor jurídico especializado em legalização de negócios no Brasil. Com base nas informações fornecidas sobre a ideia de negócio, sugira 5 etapas legais cruciais para a legalização e operação do negócio. Cada etapa deve ser específica, detalhada e focada em um aspecto particular do processo de legalização, considerando as leis e regulamentações brasileiras atuais. Inclua informações sobre documentos necessários, prazos estimados e possíveis custos envolvidos. Formate cada etapa como um item de lista numerado e inclua sub-itens se necessário."},
                {"role": "user", "content": context}
            ]
        )
        
        legal_steps = completion.choices[0].message.content.split('\n')
        legal_steps = [step.strip() for step in legal_steps if step.strip() and step[0].isdigit()]

        # Deletar etapas existentes
        LegalStep.query.filter_by(idea_id=idea_id).delete()
        
        for i, step in enumerate(legal_steps):
            new_step = LegalStep(
                idea_id=idea_id,
                description=step[step.index(' ')+1:],  # Remove o número do início
                order=i+1,
                progress=0
            )
            db.session.add(new_step)
        
        db.session.commit()
        return jsonify({"success": True, "message": f"Etapas legais geradas com sucesso: {len(legal_steps)} etapas criadas."})

    except Exception as e:
        current_app.logger.error(f"Error in legal steps generation: {str(e)}")
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/api/legal/<int:idea_id>/update_progress', methods=['POST'])
@login_required
def update_legal_step_progress(idea_id):
    data = request.json
    step_id = data.get('step_id')
    progress = data.get('progress')

    step = LegalStep.query.get_or_404(step_id)
    if step.idea.user_id != current_user.id:
        abort(403)

    step.progress = progress
    db.session.commit()

    return jsonify({"success": True})

@main.route('/api/legal/<int:idea_id>/consult', methods=['POST'])
@login_required
def legal_consultation(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    user_message = data.get('message')

    # Verificar se o usuário já enviou 10 mensagens
    user_message_count = LegalConsultation.query.filter_by(idea_id=idea_id, is_user=True).count()
    if user_message_count >= 10:
        return jsonify({"success": False, "error": "Limite de mensagens atingido"}), 400

    # Salvar a mensagem do usuário
    user_consultation = LegalConsultation(idea_id=idea_id, message=user_message, is_user=True)
    db.session.add(user_consultation)

    context = f"Ideia de negócio: {idea.description}\n\n"
    questions = Question.query.filter_by(idea_id=idea.id).all()
    for question in questions:
        context += f"Q: {question.text}\nA: {question.answer}\n\n"

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um consultor jurídico especializado em legalização de negócios. Responda às perguntas do usuário com base no contexto fornecido e nas informações mais recentes disponíveis sobre legislação e procedimentos legais para abertura de empresas."},
                {"role": "user", "content": context + f"\nPergunta do usuário: {user_message}"}
            ]
        )
        
        ai_response = completion.choices[0].message.content

        # Salvar a resposta do AI
        ai_consultation = LegalConsultation(idea_id=idea_id, message=ai_response, is_user=False)
        db.session.add(ai_consultation)
        
        db.session.commit()
        return jsonify({"success": True, "response": ai_response})

    except Exception as e:
        current_app.logger.error(f"Error in legal consultation: {str(e)}")
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/api/legal/<int:idea_id>/step_details/<int:step_id>', methods=['GET'])
@login_required
def get_legal_step_details(idea_id, step_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    step = LegalStep.query.get_or_404(step_id)
    if step.idea_id != idea_id:
        abort(404)

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um consultor jurídico especializado em legalização de negócios. Forneça detalhes específicos sobre a seguinte etapa legal, incluindo possíveis desafios, documentos necessários e dicas para completar a etapa com sucesso."},
                {"role": "user", "content": f"Detalhe a seguinte etapa legal para a ideia de negócio '{idea.title}': {step.description}"}
            ]
        )
        
        details = completion.choices[0].message.content

        return jsonify({"success": True, "details": details})

    except Exception as e:
        current_app.logger.error(f"Error in getting legal step details: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@main.route('/api/market_research/<int:research_id>', methods=['GET', 'DELETE'])
@login_required
def api_market_research(research_id):
    research = MarketResearch.query.get_or_404(research_id)
    if research.idea.user_id != current_user.id:
        abort(403)
    
    if request.method == 'GET':
        return jsonify({
            "success": True,
            "content": research.content,
            "location": research.location,
            "created_at": research.created_at.isoformat()
        })
    
    elif request.method == 'DELETE':
        try:
            db.session.delete(research)
            db.session.commit()
            return jsonify({"success": True, "message": "Pesquisa de mercado excluída com sucesso."})
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting market research: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500

@main.route('/customers/<int:idea_id>')
@login_required
def customers(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)
    customers = Customer.query.filter_by(idea_id=idea_id).order_by(Customer.name).all()
    return render_template('customers.html', idea=idea, customers=customers)

@main.route('/api/customers/<int:idea_id>', methods=['GET', 'POST'])
@login_required
def api_customers(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    if request.method == 'POST':
        try:
            data = request.json
            new_customer = Customer(
                idea_id=idea_id,
                name=data['name'],
                email=data.get('email'),
                phone=data.get('phone'),
                company=data.get('company'),
                category=data.get('category'),
                address=data.get('address'),
                notes=data.get('notes'),
                facebook=data.get('facebook'),
                instagram=data.get('instagram'),
                linkedin=data.get('linkedin'),
                twitter=data.get('twitter')
            )
            db.session.add(new_customer)
            db.session.commit()
            return jsonify({'success': True, 'customer': new_customer.to_dict()}), 201
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error saving customer: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    customers = Customer.query.filter_by(idea_id=idea_id).all()
    return jsonify({'success': True, 'customers': [customer.to_dict() for customer in customers]})

@main.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    if customer.idea.user_id != current_user.id:
        abort(403)

    if request.method == 'GET':
        return jsonify(customer.to_dict())

    elif request.method == 'PUT':
        data = request.json
        for key, value in data.items():
            setattr(customer, key, value)
        customer.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True})

    elif request.method == 'DELETE':
        db.session.delete(customer)
        db.session.commit()
        return jsonify({'success': True})

@main.route('/api/customers/<int:customer_id>/send_whatsapp', methods=['POST'])
@login_required
def send_whatsapp(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    if customer.idea.user_id != current_user.id:
        abort(403)

    data = request.json
    message = data.get('message')
    
    if not customer.phone or not message:
        return jsonify({'success': False, 'error': 'Número de telefone ou mensagem não fornecidos'}), 400

    try:
        # Ajuste o fuso horário conforme necessário
        brazil_tz = pytz.timezone('America/Sao_Paulo')
        now = datetime.now(brazil_tz)
        send_time = now + timedelta(minutes=1)  # Envia a mensagem 1 minuto a partir de agora

        pywhatkit.sendwhatmsg(customer.phone, message, send_time.hour, send_time.minute)
        return jsonify({'success': True, 'message': 'Mensagem agendada com sucesso'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/api/customers/<int:idea_id>/send_bulk_email', methods=['POST'])
@login_required
def send_bulk_email(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    data = request.json
    customer_ids = data.get('customer_ids', [])
    subject = data.get('subject')
    content = data.get('content')

    if not customer_ids or not subject or not content:
        return jsonify({'success': False, 'error': 'Dados incompletos'}), 400

    if not current_user.email_for_sending or not current_user.email_password:
        return jsonify({'success': False, 'error': 'Configurações de e-mail não definidas'}), 400

    customers = Customer.query.filter(Customer.id.in_(customer_ids), Customer.idea_id == idea_id).all()

    try:
        with current_app.app_context():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(current_user.email_for_sending, current_user.email_password)
                for customer in customers:
                    if customer.email:
                        msg = MIMEText(content)
                        msg['Subject'] = subject
                        msg['From'] = current_user.email_for_sending
                        msg['To'] = customer.email
                        server.send_message(msg)

        return jsonify({'success': True, 'message': f'E-mails enviados para {len(customers)} clientes'})
    except Exception as e:
        current_app.logger.error(f"Error sending bulk emails: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/api/customers/<int:idea_id>/stats', methods=['GET'])
@login_required
def customer_stats(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.user_id != current_user.id:
        abort(403)

    total_customers = Customer.query.filter_by(idea_id=idea_id).count()
    customers_by_status = db.session.query(Customer.status, db.func.count(Customer.id)).filter_by(idea_id=idea_id).group_by(Customer.status).all()
    customers_by_category = db.session.query(Customer.category, db.func.count(Customer.id)).filter_by(idea_id=idea_id).group_by(Customer.category).all()

    return jsonify({
        'total_customers': total_customers,
        'customers_by_status': dict(customers_by_status),
        'customers_by_category': dict(customers_by_category)
    })

@main.route('/api/improve_email', methods=['POST'])
@login_required
def improve_email():
    data = request.json
    subject = data.get('subject')
    content = data.get('content')

    if not subject or not content:
        return jsonify({'success': False, 'error': 'Assunto e conteúdo são obrigatórios'}), 400

    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Você é um especialista em marketing por e-mail. Melhore o assunto e o conteúdo do e-mail fornecido, tornando-o mais atraente e persuasivo."},
                {"role": "user", "content": f"Assunto: {subject}\n\nConteúdo: {content}"}
            ]
        )
        
        improved_text = completion.choices[0].message.content
        improved_subject, improved_content = improved_text.split('\n\n', 1)
        improved_subject = improved_subject.replace('Assunto: ', '')
        improved_content = improved_content.replace('Conteúdo: ', '')

        return jsonify({
            'success': True,
            'improved_subject': improved_subject,
            'improved_content': improved_content
        })
    except Exception as e:
        current_app.logger.error(f"Error improving email: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route('/profile_settings', methods=['GET', 'POST'])
@login_required
def profile_settings():
    form = ProfileSettingsForm()
    form.original_username = current_user.username
    form.original_email = current_user.email
    
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.email = form.email.data
        current_user.full_name = form.full_name.data
        current_user.bio = form.bio.data
        current_user.email_for_sending = form.email_for_sending.data
        current_user.email_password = form.email_password.data  # Considere criptografar isso!
        current_user.smtp_server = form.smtp_server.data
        current_user.smtp_port = form.smtp_port.data
        current_user.language = form.language.data
        current_user.timezone = form.timezone.data
        current_user.receive_notifications = form.receive_notifications.data
        
        if form.new_password.data:
            if current_user.check_password(form.current_password.data):
                current_user.set_password(form.new_password.data)
            else:
                flash('Senha atual incorreta.', 'danger')
                return redirect(url_for('main.profile_settings'))
        
        db.session.commit()
        flash('Suas configurações de perfil foram atualizadas.', 'success')
        return redirect(url_for('main.profile_settings'))
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.full_name.data = current_user.full_name
        form.bio.data = current_user.bio
        form.email_for_sending.data = current_user.email_for_sending
        form.smtp_server.data = current_user.smtp_server
        form.smtp_port.data = current_user.smtp_port
        form.language.data = current_user.language
        form.timezone.data = current_user.timezone
        form.receive_notifications.data = current_user.receive_notifications
    
    return render_template('profile_settings.html', form=form)