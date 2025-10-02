from flask import Flask, render_template, request, jsonify, session
import random as r
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

# --- Helper Functions ---

def initialize_game():
    """Initialize a new game and store it in session."""
    cards = ['R0','R1','R2','R3','R4','R5','R6','R7','R8','R9',
             'G0','G1','G2','G3','G4','G5','G6','G7','G8','G9',
             'B0','B1','B2','B3','B4','B5','B6','B7','B8','B9',
             'Y0','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9']
    
    r.shuffle(cards)
    
    play1 = []
    play2 = []
    
    # Deal 7 cards to each player
    for i in range(7):
        play1.append(cards.pop())
        play2.append(cards.pop())
    
    draw_pile = cards[:-1]
    top_card = cards[-1]
    
    session['play1'] = play1
    session['play2'] = play2
    session['draw_pile'] = draw_pile
    session['top_card'] = top_card
    session['game_over'] = False
    session['winner'] = None
    session['message'] = 'Game started! Your turn.'

def get_card_color(card):
    """Get full color name from card code."""
    colors = {'R': 'red', 'G': 'green', 'B': 'blue', 'Y': 'yellow'}
    return colors.get(card[0], 'gray')

def player2_turn():
    """Execute Player 2's turn (AI)."""
    play2 = session['play2']
    top = session['top_card']
    draw_pile = session['draw_pile']
    
    # Find valid cards
    valid_cards = [c for c in play2 if c[0] == top[0] or c[1] == top[1]]
    
    if valid_cards:
        # Play a random valid card
        p2_card = r.choice(valid_cards)
        play2.remove(p2_card)
        session['top_card'] = p2_card
        message = f'Player 2 played: {p2_card}'
    elif draw_pile:
        # Draw a card
        new_card = draw_pile.pop()
        play2.append(new_card)
        message = 'Player 2 drew a card.'
    else:
        # Skip turn
        message = 'Player 2 had no card to play. Skipping turn.'
    
    session['play2'] = play2
    session['draw_pile'] = draw_pile
    
    # Check if Player 2 won
    if len(play2) == 0:
        session['game_over'] = True
        session['winner'] = 'Player 2'
        message = 'Player 2 wins!'
    
    return message

# --- Routes ---

@app.route('/')
def index():
    """Main game page."""
    initialize_game()
    return render_template('index.html')

@app.route('/game_state')
def game_state():
    """Return current game state as JSON."""
    return jsonify({
        'play1': session.get('play1', []),
        'play1_count': len(session.get('play1', [])),
        'play2_count': len(session.get('play2', [])),
        'top_card': session.get('top_card', ''),
        'top_color': get_card_color(session.get('top_card', 'R0')),
        'draw_pile_count': len(session.get('draw_pile', [])),
        'game_over': session.get('game_over', False),
        'winner': session.get('winner', None),
        'message': session.get('message', '')
    })

@app.route('/play_card', methods=['POST'])
def play_card():
    """Handle player's card play."""
    if session.get('game_over'):
        return jsonify({'success': False, 'message': 'Game is over!'})
    
    data = request.get_json()
    card = data.get('card')
    
    play1 = session['play1']
    top = session['top_card']
    
    if card not in play1:
        return jsonify({'success': False, 'message': 'Card not in your hand!'})
    
    # Validate move
    if card[0] == top[0] or card[1] == top[1]:
        play1.remove(card)
        session['play1'] = play1
        session['top_card'] = card
        
        # Check if Player 1 won
        if len(play1) == 0:
            session['game_over'] = True
            session['winner'] = 'Player 1'
            session['message'] = 'You win! Congratulations!'
            return jsonify({'success': True, 'message': 'You win!', 'game_over': True})
        
        # Player 2's turn
        p2_message = player2_turn()
        session['message'] = f'You played {card}. {p2_message}'
        
        return jsonify({'success': True, 'message': session['message']})
    else:
        return jsonify({'success': False, 'message': f'Invalid card! {card} does not match {top}.'})

@app.route('/draw_card', methods=['POST'])
def draw_card():
    """Handle player drawing a card."""
    if session.get('game_over'):
        return jsonify({'success': False, 'message': 'Game is over!'})
    
    draw_pile = session['draw_pile']
    play1 = session['play1']
    
    if not draw_pile:
        return jsonify({'success': False, 'message': 'Draw pile is empty!'})
    
    new_card = draw_pile.pop()
    play1.append(new_card)
    
    session['draw_pile'] = draw_pile
    session['play1'] = play1
    
    # Player 2's turn
    p2_message = player2_turn()
    session['message'] = f'You drew {new_card}. {p2_message}'
    
    return jsonify({'success': True, 'message': session['message']})

@app.route('/new_game', methods=['POST'])
def new_game():
    """Start a new game."""
    session.clear()
    initialize_game()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
